# Booking management — scope

Written 2026-10-22. Every capability below exists because its absence caused a
real incident in the last three weeks, each one resolved by me running SQL
against the production database.

**That is the actual bug.** Not the individual mistakes — the fact that a
studio, an artist, or an admin had no way to fix them.

---

## The evidence

| What happened | What was missing | How it got fixed |
|---|---|---|
| Marlon attached the wrong travel receipt and "wasn't able to remove the wrong one" | Artist can't remove a reimbursement | SQL `DELETE` |
| Marlon's 10/7 class — a sub covered it | Nobody can cancel a booking | SQL `UPDATE` |
| Katya cancelled on Armonk | Same | SQL `UPDATE` |
| Sara's 10/8 class paid outside the platform | No way to record a manual payment | SQL `UPDATE` |
| McKell booked at $18/hr, should have been $20 | No way to edit a rate | SQL `UPDATE` |
| McKell's invoice then said $19 | No way to void and reissue an invoice | SQL `UPDATE` |
| McKell paid manually, link stayed live | No way to void a payment link | SQL `UPDATE` |
| Lambarri overpaid $36 | No refund or credit path | Handled off-platform |
| Sara's Stripe wasn't finished | Studio hit a wall with no visibility | Error message only |

Nine incidents, nine scripts. **None of this was self-service for anyone.**

A tenth, adjacent: **223 jobs are marked Active with a date already past**,
because nothing expires them.

---

## Foundations

These come first. Every capability below depends on them, and building the
features without them is how the next $36 goes missing quietly.

### F1 — An audit trail
`bookings` has **no** `updatedBy`, no history, nothing. Right now there is no
way to answer "who changed this rate, and when". Before we let three kinds of
user edit bookings, every change needs: who, when, what changed, old value,
new value, and a reason where one is required.

*Needs a new table. This is the single most important item in this document.*

### F2 — The immutability rule
One rule, enforced server-side, not per-screen:

- **Unpaid** → editable.
- **Paid** → the money has moved. Nothing that would change what was charged
  may be edited. Corrections happen as a **new** adjustment, never by rewriting
  history.

Every script I wrote today refuses on `invoicePaidAt`. That logic belongs in
the server once, not in nine scripts.

### F3 — Stale payment links die
A booking that is cancelled, repriced or settled must have its payment token
and checkout URL voided in the same transaction. McKell's $19 link stayed live
and payable after the booking was repriced; her $759.33 link stayed live after
she was paid manually. Both were only closed because I remembered to.

---

## Agreed model (decided 2026-10-22)

Two principles settled the shape of this:

1. **Anything that moves money, or says money moved, is admin-only.** Marking a
   booking paid and changing its status both sit with admin. A studio marking
   its own booking paid is open to abuse and loses the fee; an artist doing it
   is worse.
2. **The agreement needs two parties.** Rate and hours are not "details" — they
   are what both sides agreed to. Neither side may change them unilaterally.
   An admin can, and is recorded as having done so.

### Who can do what

| | Artist | Client | Admin |
|---|---|---|---|
| Date, location, description, notes | ✅ | ✅ | ✅ |
| Reimbursements (add / edit / remove, until paid) | ✅ | ✅ | ✅ |
| Rate | propose → other accepts | propose → other accepts | ✅ direct |
| Hours | submit (existing flow) | adjust at approval (existing) | ✅ direct |
| Cancel (until paid) | ✅ reason required | ✅ reason required | ✅ |
| Change status | ❌ | ❌ | ✅ |
| Mark paid manually | ❌ | ❌ | ✅ |
| Record a refund / credit | ❌ | ❌ | ✅ |

Artists and clients share the same endpoints, differing only in which side of
the booking they are on. One implementation, two callers.

### Artist specifics

| # | Capability | Guardrails |
|---|---|---|
| A1 | Remove / edit / add a reimbursement until paid | Marlon's exact request |
| A2 | Edit logistics fields | Client is notified of the change |
| A3 | Withdraw a submitted invoice | Voids the link; returns the booking to "to complete" |
| A4 | Propose a rate change | Takes effect only when the client accepts |
| A5 | See their own payout readiness on the booking | Sara's case |

### Client specifics

| # | Capability | Guardrails |
|---|---|---|
| C1 | Adjust hours at approval | ✅ already exists |
| C2 | Send an invoice back with a reason | ✅ already exists |
| C3 | Remove / edit / add a reimbursement until paid | Same endpoint as A1 |
| C4 | Edit logistics fields | Artist is notified |
| C5 | Propose a rate change | Takes effect only when the artist accepts |
| C6 | See a payment history per booking | Charged, refunded, outstanding |

### Admin specifics

Maps onto the existing **GitHub #6**.

| # | Capability | Notes |
|---|---|---|
| D1 | Edit any unpaid booking, including rate and hours | The McKell $18→$20 case |
| D2 | Cancel any unpaid booking, with a reason | Marlon 10/7, Katya |
| D3 | Mark paid manually, recording amount and method | Sara, McKell |
| D4 | Void / reissue an invoice | Repricing currently means clearing a Stripe URL by hand |
| D5 | Record a refund or credit against a paid booking | Lambarri's $36 |
| D6 | Add / edit / remove reimbursements | What nobody could do for Marlon |
| D7 | Duplicate a booking | From GitHub #6 |
| D8 | Bulk-cancel or reschedule class dates | A term is 39 rows |
| D9 | See an artist's payout readiness | Sara's case, from the admin side |
| D10 | Full change history on a booking | F1, surfaced |

### Two rules that fell out of this

**Editing a submitted-but-unpaid booking withdraws its invoice.** Otherwise the
invoice and the booking silently diverge and the studio pays against a stale
figure.

**Cancellation is allowed at any time, always notifies, and is always
recorded.** Blocking late cancellations does not stop them happening — Katya
cancelled on Armonk the same day — it only stops them being recorded.

So instead of a cutoff, every cancellation captures:

| Field | Why |
|---|---|
| `cancelledBy` | artist / client / admin, and which user |
| `cancelledAt` | when |
| `cancellationReason` | required, free text |
| `noticeHours` | hours between the cancellation and the class start |
| `isLateCancellation` | derived: notice under 48h |

`noticeHours` is the field that matters. "Katya cancelled" and "Katya cancelled
four hours before a class a studio had been promised" are different facts, and
only the second one is actionable.

**Where it surfaces**

- On the artist's and the client's admin profile: *"3 late cancellations in
  the last 6 months"*. A studio asking "can I rely on this person" is a
  question you currently cannot answer.
- A cancellations report, filterable by late-only, so a pattern is visible
  before a studio complains.
- On the booking itself, in its history (F1).

This is deliberately a record, not a penalty. What a repeated late canceller
costs you is a policy decision, and it needs the data before it needs a rule.

## Guardrails — the rules that must hold

1. **Nothing edits a paid booking's money.** Corrections are adjustments.
2. **Rate changes are agreed, not imposed** — except by an admin, who is
   recorded as having done it.
3. **Every status change voids stale payment links** in the same transaction.
4. **Every edit is attributed and reversible to read**, even where it isn't undoable.
5. **Any side that didn't make the change is notified**, with the before and after.
6. **The server enforces all of this**, so a new screen can't bypass it.

---

## Suggested order

**Phase 1 — stop the bleeding** *(covers 7 of the 9 incidents)*
F1 audit trail · F2 immutability · F3 link voiding · D1 edit · D2 cancel ·
D3 mark paid · D6 reimbursements

**Phase 2 — self-service** *(stops the tickets reaching you)*
A1 · A2 · A3 · C3 · C5

**Phase 3 — the rest**
D4 · D5 · D7 · D8 · D9 · A4 · A5 · C4 · C6 · job auto-expiry

Phase 1 is the one that matters. Everything I did by hand this week falls
inside it.

---

## Open questions

**1. ~~Can artists and clients cancel directly?~~ DECIDED — directly.**
No cutoff, mandatory reason, notification to support@ and the other party, and
the notice period recorded (above). Cancellation is the one status change
artists and clients may make; every other status change stays with admin.

**2. Refunds — in-app or Stripe dashboard?**
In-app is a bigger build and needs live Stripe keys on the server. Phase 3 at
the earliest; the dashboard is fine until then.

**3. Cancelled vs deleted?**
Everything so far uses Cancelled — a called-off class is part of the record,
and `deleted` hides it from every report. Open to a true delete for rows
created in error (a test booking, a duplicate).

## Explicitly out of scope

- Issuing Stripe refunds programmatically (phase 3 at the earliest)
- Editing a paid booking's amounts — by design, forever
- Artists setting their own rate post-confirmation
- Partial payments or payment plans
