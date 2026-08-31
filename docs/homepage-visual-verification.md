# Homepage Visual Verification

## Fresh unauthenticated desktop viewport

- The hirer card displays “Post Your First Job - It's Free!” and the requested supporting sentence.
- The email field and larger multiline job-description field are visible, balanced, and legible.
- The primary CTA displays “Post a Job →”.
- The “Browse all artists” link is hidden while the artist-marquee heading remains properly aligned.

## Fresh unauthenticated mobile viewport

- Navigation, headline, audience toggle, email input, multiline job field, and CTA fit within a 390 × 844 viewport without horizontal overflow.
- The multiline field remains large enough for a useful job draft and the copy wraps cleanly.

## Remaining visual checks

- The two-column FAQ layout, audience tabs, accordion, contact prompt, and default Hirer questions render cleanly in the full-page print check.
- The requested footer navigation is removed and the remaining legal row is balanced.
- The initially selected light logo was invisible on white, so the footer was corrected to use the managed orange Artswrk wordmark.
- The Artist FAQ content is covered by the same responsive component and verified through the FAQ regression test.
- The managed orange source asset was inspected directly and contains the complete orange-gradient ARTSWRK wordmark on transparency at 6322 × 1374 pixels.
- The print renderer does not reliably wait for the storage-proxy image redirect in the footer; the storage path and source asset were therefore verified separately in addition to the page layout check.

## Complete desktop and mobile tile review

The full desktop tile sequence confirms the updated business blurbs, title-cased posting buttons, artist introduction, remote-job labels, How It Works copy, Hirer FAQ panel, CTA, and orange footer logo all render in order without overlap. The full mobile sequence through the FAQ confirms that cards stack correctly, text remains legible, the FAQ tabs fit within the viewport, and the expanded answer does not cause horizontal overflow.

The final mobile tiles confirm that the FAQ flows into the gradient CTA and footer without clipping. The orange ARTSWRK logo, copyright, and legal links remain visible and balanced at 390 pixels wide. A read-only API smoke test also confirmed the homepage lookup returns `exists: true` for the existing contact account and `exists: false` for a deliberately nonexistent address.
