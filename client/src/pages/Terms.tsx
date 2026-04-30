import Navbar from "@/components/Navbar";

const LAST_UPDATED = "April 29, 2026";

export default function Terms() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <div className="max-w-2xl mx-auto px-6 pt-32 pb-24">

        {/* Breadcrumb links */}
        <div className="flex items-center gap-4 text-xs text-gray-400 mb-10">
          <a href="/terms" className="font-semibold text-[#111] border-b border-[#111]">Terms of Service</a>
          <span>·</span>
          <a href="/privacy-policy" className="hover:text-[#F25722] transition-colors">Privacy Policy</a>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-black text-[#111] mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-400 mb-12">Last updated: {LAST_UPDATED}</p>

        <div className="prose-legal">

          <section>
            <h2>1. Agreement to Terms</h2>
            <p>By accessing or using Artswrk at artswrk.com (the "Platform"), you agree to be bound by these Terms of Service and our Privacy Policy. If you do not agree, please do not use the Platform.</p>
            <p>Artswrk is a marketplace that connects artists and performers with studios, schools, event companies, and other individuals seeking to book creative talent.</p>
          </section>

          <section>
            <h2>2. Eligibility</h2>
            <p>You must be at least 18 years old to create an account and use Artswrk. By using the Platform, you represent that you meet this requirement.</p>
            <p>Businesses must be legally registered and have the authority to enter into these Terms on behalf of the entity.</p>
          </section>

          <section>
            <h2>3. Accounts</h2>
            <p>You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. Notify us immediately at <a href="mailto:hello@artswrk.com">hello@artswrk.com</a> if you suspect unauthorized access.</p>
            <p>You may not create multiple accounts, use another person's account, or create an account if we have previously removed your account.</p>
          </section>

          <section>
            <h2>4. Artist Accounts</h2>
            <p>Artists may create a free profile and browse job listings. To apply to jobs and gain full access to the marketplace, a paid subscription (Artswrk Basic or Artswrk PRO) is required.</p>
            <p>Artists are responsible for the accuracy of their profile information, including skills, experience, and availability. Misrepresentation may result in account suspension.</p>
            <p>Artists are independent contractors, not employees of Artswrk. You are solely responsible for your taxes, insurance, and compliance with applicable laws.</p>
          </section>

          <section>
            <h2>5. Client Accounts</h2>
            <p>Clients may post job listings and browse artist profiles. Job posting fees or subscription plans apply as described on our pricing page.</p>
            <p>Clients are responsible for ensuring job listings are accurate, lawful, and not discriminatory. We reserve the right to remove any listing that violates these Terms.</p>
            <p>Clients are responsible for all payments made directly to Artists. Artswrk is not liable for payment disputes between Clients and Artists.</p>
          </section>

          <section>
            <h2>6. Payments &amp; Subscriptions</h2>
            <p>Subscriptions are billed in advance on a monthly basis. All fees are non-refundable except as required by law or at our sole discretion.</p>
            <p>You may cancel your subscription at any time. Cancellation takes effect at the end of the current billing period — you retain access until that date.</p>
            <p>We use Stripe to process payments securely. By providing payment information, you agree to Stripe's Terms of Service. We do not store your full payment details.</p>
            <p>We reserve the right to change pricing with 30 days' notice. Continued use of the Platform after a price change constitutes acceptance.</p>
          </section>

          <section>
            <h2>7. Prohibited Conduct</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Post false, misleading, or fraudulent content</li>
              <li>Harass, abuse, or threaten other users</li>
              <li>Circumvent the Platform to avoid fees (e.g., soliciting Artists discovered through Artswrk outside the Platform)</li>
              <li>Scrape, copy, or redistribute Platform data without written permission</li>
              <li>Use the Platform for any unlawful purpose</li>
              <li>Interfere with or disrupt the Platform's infrastructure</li>
              <li>Post job listings that are discriminatory, exploitative, or otherwise unlawful</li>
            </ul>
          </section>

          <section>
            <h2>8. Intellectual Property</h2>
            <p>The Artswrk name, logo, and all Platform content (excluding user-submitted content) are owned by Artswrk and protected by applicable intellectual property laws.</p>
            <p>You retain ownership of content you submit. By submitting content (profile photos, portfolio work, job descriptions), you grant Artswrk a non-exclusive, worldwide, royalty-free license to display and distribute that content for the purpose of operating the Platform.</p>
          </section>

          <section>
            <h2>9. Disclaimers</h2>
            <p>Artswrk is provided "as is" without warranties of any kind. We do not guarantee that the Platform will be uninterrupted or error-free.</p>
            <p>We do not verify the qualifications, identity, or background of Artists or Clients. You are responsible for conducting your own due diligence before entering into any agreement.</p>
          </section>

          <section>
            <h2>10. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, Artswrk and its officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Platform.</p>
            <p>Our total liability to you for any claim shall not exceed the amount you paid to Artswrk in the 12 months preceding the claim.</p>
          </section>

          <section>
            <h2>11. Indemnification</h2>
            <p>You agree to indemnify and hold harmless Artswrk and its affiliates from any claims, damages, or expenses (including legal fees) arising from your use of the Platform, your content, or your violation of these Terms.</p>
          </section>

          <section>
            <h2>12. Termination</h2>
            <p>We may suspend or terminate your account at any time for violation of these Terms or for any other reason at our discretion. You may delete your account at any time by contacting us at <a href="mailto:hello@artswrk.com">hello@artswrk.com</a>.</p>
          </section>

          <section>
            <h2>13. Governing Law</h2>
            <p>These Terms are governed by the laws of the State of New York, without regard to conflict of law principles. Any disputes shall be resolved in the state or federal courts located in New York County, New York.</p>
          </section>

          <section>
            <h2>14. Changes to These Terms</h2>
            <p>We may update these Terms from time to time. We will notify you of material changes by email or a notice on the Platform. Continued use after changes take effect constitutes acceptance.</p>
          </section>

          <section>
            <h2>15. Contact</h2>
            <p>Questions about these Terms? Email us at <a href="mailto:hello@artswrk.com">hello@artswrk.com</a>.</p>
          </section>

        </div>

        <div className="border-t border-gray-100 mt-14 pt-8 flex items-center gap-6 text-xs text-gray-400">
          <a href="/terms" className="font-semibold text-[#111]">Terms of Service</a>
          <a href="/privacy-policy" className="hover:text-[#F25722] transition-colors">Privacy Policy</a>
          <span className="ml-auto">{LAST_UPDATED}</span>
        </div>

      </div>

      <style>{`
        .prose-legal section { margin-bottom: 2.5rem; }
        .prose-legal h2 { font-size: 1rem; font-weight: 700; color: #111; margin-bottom: 0.75rem; }
        .prose-legal p { font-size: 0.9375rem; color: #4b5563; line-height: 1.8; margin-bottom: 0.875rem; }
        .prose-legal ul { margin: 0.25rem 0 0.875rem 1.25rem; list-style-type: disc; }
        .prose-legal ul li { font-size: 0.9375rem; color: #4b5563; line-height: 1.8; margin-bottom: 0.25rem; }
        .prose-legal a { color: #F25722; text-decoration: none; }
        .prose-legal a:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
}
