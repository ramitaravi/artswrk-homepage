# Known security risks — accepted, not fixed

Risks that have been surfaced, understood and deliberately deferred. Each one
says what it is, who it affects, what it would take to close, and when the
decision was made. Nothing here is a mystery — it is a list of choices.

---

## 1. Anyone can claim an account that has no password

**Status:** accepted 2026-10-19 (Ramita) — revisit before or shortly after launch.
**Severity:** high — full account takeover, no authentication required.

### What it is

Two public endpoints in `server/routers.ts` back the sign-in screen at `/app`:

- **`auth.lookupEmail`** — takes any email and returns whether the account
  exists plus the person's **first name, role, profile picture and company
  name**. Email enumeration and a small PII leak.
- **`auth.setInitialPassword`** — takes an email and a password. The only check
  is `if (user.passwordHash) throw`. If the account has never had a password,
  it sets one and returns a **session cookie**.

So the "if they have an account already they can create a password" branch
takes the visitor's **word** that the email is theirs. Nothing proves it — no
emailed link, no code, no verification of any kind.

### Who it affects

As of 2026-10-19:

| | Count |
|---|---|
| All accounts with no password | **7,299** |
| …of those, created by an admin | 2,561 |
| …of those, admin-added who have since set one | 48 |

Artists routinely publish their professional email, so the input an attacker
needs is often public information.

### What an attacker gets

A real signed-in session on that person's account: profile, message history,
booking history, earnings, and the connected Stripe payout account. They can
also **raise invoices to that artist's real clients** through the artist
invoicing flow, which emails those clients a payment request from Artswrk.

### Why it exists

It is the Bubble migration claim flow. Thousands of accounts came across with
no password and this is how they get in. Closing it outright without a
replacement would strand them.

### How to close it

Keeping the intended three-branch UX (has password → sign in; account but no
password → create one; no account → sign up), in increasing order of work:

1. **Stop leaking.** Drop `firstName`, `profilePicture` and `clientCompanyName`
   from `lookupEmail`, and rate-limit it per IP and per email. Narrows the
   enumeration without changing any flow. *Smallest useful step.*
2. **Verify the email inline.** On the "create a password" branch, email a
   6-digit code and require it alongside the new password. Same single screen,
   same mental model, one extra field.
3. **Require a token.** Make claiming an existing account only possible through
   an emailed link. Most correct, and needs a bulk resend so nobody is stranded
   — `admin.sendWelcomeEmail` already mints a fresh 7-day claim link per artist.

The emailed invite path (`/reset-password?token=…`) is already safe: the token
is proof of email ownership. Only the `/app` shortcut is unverified.

### What was deliberately NOT done

The admin invite email was pointed at the **token** page, not at `/app`, so the
invite flow does not depend on this hole. The token page was restyled to carry
the welcoming copy instead.
