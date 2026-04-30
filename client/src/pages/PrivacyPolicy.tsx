import Navbar from "@/components/Navbar";

const LAST_UPDATED = "April 29, 2026";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <div className="max-w-2xl mx-auto px-6 pt-32 pb-24">

        {/* Breadcrumb links */}
        <div className="flex items-center gap-4 text-xs text-gray-400 mb-10">
          <a href="/terms" className="hover:text-[#F25722] transition-colors">Terms of Service</a>
          <span>·</span>
          <a href="/privacy-policy" className="font-semibold text-[#111] border-b border-[#111]">Privacy Policy</a>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-black text-[#111] mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-12">Last updated: {LAST_UPDATED}</p>

        <div className="prose-legal">

          <section>
            <h2>1. Introduction</h2>
            <p>Artswrk operates artswrk.com. This Privacy Policy explains how we collect, use, disclose, and protect your personal information when you use our platform.</p>
            <p>By using Artswrk, you agree to the collection and use of information as described in this policy.</p>
          </section>

          <section>
            <h2>2. Information We Collect</h2>
            <p><strong>Information you provide directly:</strong></p>
            <ul>
              <li>Account information: name, email address, password</li>
              <li>Profile information: photo, artist type, skills, location, bio</li>
              <li>Business information: company name, website, phone number, address</li>
              <li>Payment information: processed securely via Stripe (we never store card details)</li>
              <li>Messages sent through the Platform and support emails</li>
              <li>Job listings and applications you create or submit</li>
            </ul>
            <p><strong>Information collected automatically:</strong></p>
            <ul>
              <li>Usage data: pages visited, features used, session duration</li>
              <li>Device data: IP address, browser type, operating system</li>
              <li>Cookies and similar tracking technologies (see Section 7)</li>
            </ul>
            <p><strong>Information from third parties:</strong></p>
            <ul>
              <li>If you sign in with Google, we receive your name and email from Google</li>
              <li>Payment and subscription status from Stripe</li>
            </ul>
          </section>

          <section>
            <h2>3. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul>
              <li>Create and manage your account</li>
              <li>Connect Artists with Clients through job listings and profiles</li>
              <li>Process payments and manage subscriptions</li>
              <li>Send transactional emails (booking confirmations, messages, job alerts)</li>
              <li>Send marketing emails about new features — you can opt out anytime</li>
              <li>Improve and personalize your experience on the Platform</li>
              <li>Detect and prevent fraud, abuse, and security incidents</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2>4. How We Share Your Information</h2>
            <p>We do not sell your personal information.</p>
            <p><strong>With other users:</strong> Artist profiles (name, photo, skills, location) are visible to Clients. Client company names appear on job listings visible to Artists.</p>
            <p><strong>With service providers:</strong> We work with trusted third parties including Stripe (payments), email delivery providers, and cloud infrastructure providers. These parties only access data needed to perform their services.</p>
            <p><strong>For legal reasons:</strong> We may disclose your information if required by law, court order, or to protect the rights, property, or safety of Artswrk, our users, or the public.</p>
            <p><strong>Business transfers:</strong> If Artswrk is acquired or merged, your information may be transferred as part of that transaction.</p>
          </section>

          <section>
            <h2>5. Data Retention</h2>
            <p>We retain your personal information for as long as your account is active or as needed to provide services. If you delete your account, we will delete or anonymize your personal data within 90 days, except where retention is required by law.</p>
          </section>

          <section>
            <h2>6. Your Rights &amp; Choices</h2>
            <p>Depending on your location, you may have the right to:</p>
            <ul>
              <li><strong>Access</strong> — request a copy of the personal data we hold about you</li>
              <li><strong>Correction</strong> — update or correct inaccurate information via your account settings</li>
              <li><strong>Deletion</strong> — request deletion of your account and personal data</li>
              <li><strong>Opt-out of marketing</strong> — unsubscribe via the link in any email we send</li>
              <li><strong>Portability</strong> — request a portable copy of your data</li>
            </ul>
            <p>To exercise any of these rights, email us at <a href="mailto:hello@artswrk.com">hello@artswrk.com</a>.</p>
          </section>

          <section>
            <h2>7. Cookies</h2>
            <p>We use cookies and similar technologies to keep you logged in, understand how you use the Platform, and improve your experience.</p>
            <ul>
              <li><strong>Essential cookies:</strong> Required for authentication and core functionality</li>
              <li><strong>Analytics cookies:</strong> Help us understand usage patterns such as page views and feature adoption</li>
            </ul>
            <p>You can disable cookies in your browser settings, but this may limit some functionality.</p>
          </section>

          <section>
            <h2>8. Security</h2>
            <p>We implement industry-standard security measures including encrypted connections (HTTPS), hashed passwords, and access controls. However, no method of internet transmission is 100% secure.</p>
            <p>If you believe your account has been compromised, contact us immediately at <a href="mailto:hello@artswrk.com">hello@artswrk.com</a>.</p>
          </section>

          <section>
            <h2>9. Children's Privacy</h2>
            <p>Artswrk is not intended for users under 18 years of age. We do not knowingly collect personal information from minors. If we learn we have collected such data, we will delete it promptly.</p>
          </section>

          <section>
            <h2>10. Third-Party Links</h2>
            <p>The Platform may contain links to third-party websites such as artist portfolios or client sites. We are not responsible for the privacy practices of those sites and encourage you to review their policies.</p>
          </section>

          <section>
            <h2>11. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of material changes via email or a notice on the Platform. The "Last updated" date at the top of this page reflects the most recent revision.</p>
          </section>

          <section>
            <h2>12. Contact</h2>
            <p>Questions or data requests? Email us at <a href="mailto:hello@artswrk.com">hello@artswrk.com</a>.</p>
          </section>

        </div>

        <div className="border-t border-gray-100 mt-14 pt-8 flex items-center gap-6 text-xs text-gray-400">
          <a href="/terms" className="hover:text-[#F25722] transition-colors">Terms of Service</a>
          <a href="/privacy-policy" className="font-semibold text-[#111]">Privacy Policy</a>
          <span className="ml-auto">{LAST_UPDATED}</span>
        </div>

      </div>

      <style>{`
        .prose-legal section { margin-bottom: 2.5rem; }
        .prose-legal h2 { font-size: 1rem; font-weight: 700; color: #111; margin-bottom: 0.75rem; }
        .prose-legal p { font-size: 0.9375rem; color: #4b5563; line-height: 1.8; margin-bottom: 0.875rem; }
        .prose-legal strong { color: #111; font-weight: 600; }
        .prose-legal ul { margin: 0.25rem 0 0.875rem 1.25rem; list-style-type: disc; }
        .prose-legal ul li { font-size: 0.9375rem; color: #4b5563; line-height: 1.8; margin-bottom: 0.25rem; }
        .prose-legal a { color: #F25722; text-decoration: none; }
        .prose-legal a:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
}
