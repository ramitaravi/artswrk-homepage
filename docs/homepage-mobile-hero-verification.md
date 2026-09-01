# Homepage Mobile Hero Verification

Verified on fresh unauthenticated browser sessions after the responsive repair.

| Viewport | Result |
|---|---|
| Mobile, 390 × 844 | The fixed navigation no longer clips the hero. The heading fills most of the usable width without horizontal overflow, and the signup card follows the hero copy with a compact but readable gap. |
| Desktop, 1440 × 1000 | The intended two-column hero remains intact. Heading scale, signup-card alignment, navigation clearance, and content spacing remain balanced. |

The malformed empty-unit inline declarations were removed. The hero now uses responsive Tailwind typography, mobile-first spacing, and a grid minimum that cannot exceed the available width.
