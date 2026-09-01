# Dance Competitions Live/Repository Source Gap

Verified on 2026-09-01 against `https://artswrk.com/dance-competitions`.

The live production page currently renders the compact design headed **“The #1 Platform to Hire Dance Competition Staff”**, with a **“Tell us what you need”** form, simple staff/stat sections, three **How It Works** cards, FAQs, and the final hiring CTA.

GitHub `main` currently renders a different design headed **“Hire Dance Competition Staff on Artswrk”**, with the enterprise dashboard mock and Judge Experience section. That version matches the screenshots the user identified as out of date.

The live design source is present in the `landing-page-redesign` branch and is byte-identical to the version in `qa-fixes-dashboard-titles-rates`. Neither branch is based on current `main`; the live page is therefore not recoverable through a normal branch merge. The page must be restored deliberately from the branch version while retaining current inquiry routing, managed media, route metadata, and global Brevo widget work.

The production DOM and full HTML were captured during the comparison. The live source includes the hero text, form labels/placeholders, staff/stat content, How It Works content, FAQ copy, and final CTA needed for verification.
