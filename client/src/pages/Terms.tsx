import Navbar from "@/components/Navbar";

const LAST_UPDATED = "April 5, 2023";

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
          <span>·</span>
          <a href="/cancellation-policy" className="hover:text-[#F25722] transition-colors">Cancellation Policy</a>
        </div>

        {/* Title */}
        <h1 className="text-4xl font-black text-[#111] mb-2">Terms &amp; Conditions</h1>
        <p className="text-sm text-gray-400 mb-12">Last Updated: {LAST_UPDATED}</p>

        <div className="prose-legal">

          <section>
            <p>Artswrk, Inc. (referred to as "Artswrk", "we", or "our") is a two-sided on-demand marketplace for dance studios, businesses, companies, or individuals (together referred to as "Client(s)") to book and artists and creatives ("Artist(s)") based on their services and rates for engagements and events (referred to as our "Services").</p>
            <p>Artists can create a profile outlining their creative services on Artswrk's website (https://artswrk.com) (the "Website") to find work in creative industries. Artist can be booked directly by Client's on the Website for a specific engagement (referenced herein as a "Job(s)"). Artists, Clients, and online browsers shall together be referred to as "you" or "User(s)". Client and Artist shall each be referred to separately as a "Party", and collectively as the "Parties".</p>
            <p>The following Terms and Conditions (hereinafter referred to as the "Terms") between you and Artswrk describe the specifications on which you may access, register, subscribe, and/or use our Website, including all information, tools, and resources available to you, conditioned upon your acceptance of all the terms, conditions, policies, and notices stated herein.</p>
            <p>By visiting, subscribing to, using, or accessing our Website; registering and creating an account; and/or otherwise utilizing our Services; you agree to be bound by these Terms.</p>
            <p>PLEASE READ THESE TERMS CAREFULLY AS THEY CONTAIN VERY IMPORTANT INFORMATION REGARDING YOUR RIGHTS AND OBLIGATIONS; AS WELL AS CONDITIONS, LIMITATIONS, AND EXCLUSIONS THAT MAY APPLY TO YOU. YOU SHOULD ALSO CAREFULLY REVIEW ARTSWRK'S PRIVACY POLICY BEFORE USING OUR WEBSITE AND ENGAGING IN ANY OF OUR SERVICES</p>
            <p>Any new features or tools which are later added to our Website shall also be subject to the Terms outlined herein. You can review the most current version of the Terms at any time on this page. Artswrk reserves the right to update, change, or replace any part of these Terms at any time by posting updates and/or changes directly to our Website in our sole discretion. It is your responsibility to check this page periodically for changes. Your continued use of, or access to, our Website and/or our Services following the posting of any changes to these Terms constitutes acceptance of those changes.</p>
          </section>

          <section>
            <h2>1. User Accounts; Registration &amp; Maintenance</h2>
            <p>In order to register for our Services on the Website, you will be required to create an account.</p>
            <p>If you are a Client seeking to book an Artist for their services, then you may create a Client account ("Client Account(s)"). If you are an Artist seeking a job, work, or bookings, then you may create an Artist account ("Artist Account(s)"). Client Accounts and Artist Accounts together shall be referred to as a "User Account(s)".</p>
            <p>To register and create your User Account, you must provide your first and last name, email address, account password, your payment information, a description, and if you are an Artist, a resume (together your "Personal Information"). Once you have created your User Account, you will receive an email from Artswrk to authenticate your User Account by verifying your email address and password.</p>
            <p>You represent and warrant that at all times (a) the information that you provide shall be true, accurate, current, and complete; and (b) you will keep your User Account and public profile up to date. Our Services may include an interactive online forum, private messaging capabilities, group meetings, events, a social network, and/or a professional network related to your User Account. As stated above, Artists creating Artist Accounts may publish their resume as part of their Personal Information which may be provided to potential Clients.</p>
            <p>Our Services may allow the sharing of your information, including but not limited to, your User Account, certain Personal Information, your profile, links that you share, Job postings, works you that share, photos, videos, and private and/or public messages. Your engagement with our Services (including but not limited to, interaction with other members, posting on forums, advertisements, or User generated content viewed or accessed) may be shared with others in accordance with our Privacy Policy and these Terms.</p>
            <p>You shall be responsible for (a) all activities that transpire on or with your User Account; (b) any content you contribute, in any manner, to your User Account and our Website; and (c) any act or omission related to your User Account, or the use thereof, that would be deemed a violation of these Terms. You acknowledge that you may pause and/or delete your User Account through our Website at any time and for any reason.</p>
          </section>

          <section>
            <h2>2. Job Posting and Payment</h2>
            <p>Clients may book Artists for their services directly through their Client Account on the Website as follows:</p>
            <ol>
              <li>Client shall enter the Job details on the Website, and Artswrk will send the Client's Job posting(s) to relevant Artists. Artswrk shall also post the Job on its Job board with an interactive Job map that incorporates locations.</li>
              <li>Artswrk automatically connects interested Artists to Client, which includes Artist's resume and an optional message.</li>
              <li>If Client decides to book an Artist, Artswrk enters the booking into its administrative dashboard and sends the Artist and Client a confirmation email</li>
              <li>Ten (10) minutes after the Job time begins, the Artist will receive an email to complete the booking and upload any reimbursements.</li>
              <li>Once completed, Client receives an email to process payment as outlined below.</li>
              <li>Both Artist and Client receive a confirmation email upon payment.</li>
              <li>Both Artist and Client can view Artswrk's administrative dashboard with their own personalized "wallet" to review a full list of completed Jobs, confirmed bookings, payments, as well as future Jobs and earnings.</li>
            </ol>
            <p><strong>Payment Structure.</strong> Once Artist and Client complete the terms of the Job, Client will receive an email to process payment for Artist's Services. For successful payment, the Artist must obtain a Stripe ID by connecting their Artist Account through Stripe; and Client must obtain a Client customer ID and client card ID. Artswrk shall not be liable to any Party for any late or defaulted payments, or any reimbursements or refunds except as outlined in the Cancellation Policy in Section 4.</p>
          </section>

          <section>
            <h2>3. Artswrk Payments, Commission &amp; Subscription Model</h2>
            <p><strong>Artist Premium Subscription.</strong> All Artists that create an Artist Account will receive access to Artswrk's Artist Premium Subscription. The Artists Premium Subscription provides various add-ons as well as prioritizes Artist for higher value Jobs. The Artist Premium Subscription may be added on by the Artist for five dollars and ninety-nine cents ($5.99) per month or sixty-five dollars ($65.00) per year.</p>
            <p><strong>Commission.</strong> Artswrk receives between five to ten percent (5-15%) of each Job booking transaction depending on the Artist's hourly rate which is paid by the Client as an additional fee upon payment being processed ("Commission"). For the avoidance of doubt, Artists do not pay Commission to Artswrk directly. Commission is based only on the cost of the Artist themselves and does not include additional amounts for any reimbursement to Artist. Artswrk shall notify Client of the Commission percentage in the administrative dashboard prior to finalizing the transaction. Except as outlined in the Cancellation Policy in Section 4, Artswrk's Commission is non-refundable and Artswrk shall receive its Commission regardless of Artists performance, Client's satisfaction, or any other issues, including in the event of a dispute or refund between the Parties.</p>
            <p><strong>No Resale.</strong> All Services, Resources, and any other items on the Website are for your use only and you agree not to, whether for a fee or without charge, reproduce, duplicate, copy, sell, transfer, resell, re-provision, redistribute, or rent any portion thereof. Any unauthorized use shall be considered a breach of these Terms.</p>
            <p><strong>Non-Solicitation.</strong> By creating a User Account on the Website, Users represent and warrant that all transactions and bookings with any Artist or Client found on the Website or through Artswrk shall continue to be booked directly on the Website. Users agree not to solicit any Clients or Artists for the purposes of offering or attempting to offer Jobs or their services outside of Artswrk. If a User breaches this clause, Artswrk has the ability to terminate their User Account due to breach of these Terms.</p>
            <p><strong>Non-Circumvention.</strong> In the event that any User solicits a Client or Artist for a Job or their services, User agrees that it shall not circumvent Artswrk its Commission and compensate Artswrk as an additional payment through their User Account.</p>
          </section>

          <section>
            <h2>4. Cancellation Policy</h2>
            <p>In the event a Client payment is processed through a booking transaction on the Website, Artswrk implements this cancellation policy in order to protect the Artist and Client's time, energy, and financial well-being.</p>
            <p>After a booking is confirmed via email to the client and to the artist, either the client or the artist may cancel that booking at any time for any reason up to 48 hours prior to the expected delivery of services, with no consequence. If canceled within 48 hours of the booking start time, unless due to an Act of God, either party is subject to the following:</p>
            <p>If canceled by the client within the 48-hour window, there is a three-time incident policy in which there is a note made on your Artswrk account for the first two short-notice cancellations; after the third short-notice cancellation, the client's account will be prevented from posting booking inquiries for 90 days. After the 90-day period, the incidents will reset to zero and the client will be able to book through Artswrk once again.</p>
            <p>If canceled by the artist within the 48-hour window, there is a three-time incident policy in which there is a note made on your Artswrk account for the first two short-notice cancellations; after the third short-notice cancellation, the artist's account will be prevented from receiving booking inquiries for 90 days. After the 90-day period, the incidents will reset to zero and the artist will be able to be booked through Artswrk once again.</p>
            <p>If the booking is confirmed within 48 hours, any cancellation is subject to the above cancellation policy. We understand last-minute bookings and cancellations may occur, and we will work with you to ensure as much fairness and equity in this process as possible, and we welcome your feedback as such occasions arise.</p>
            <p>Clients and artists may share any good faith disputes or request changes to the service(s) selected, associated payments, service cancellation, and/or payment refund by emailing <a href="mailto:contact@artswrk.com">contact@artswrk.com</a>. We appreciate your cooperation and the opportunities to connect creative work and consistent income with these incredible artists.</p>
            <p><strong>Issues; Refunds.</strong> Pursuant to this Section, Parties understand that Artswrk is a third party booking Website, and that it shall not be liable for any dissatisfaction by Artist or Client regarding the Job, Services, expectations, arrival and departure times, payments, refunds, or any other issues that arise between the Parties or any third parties regarding the Job and transaction. Artswrk does not handle any refunds or claims between the Parties outside of cancellation, and the Parties are solely liable for handling all discrepancies amongst themselves. In the event either Party decides to administer a refund, the Parties agree that such refund shall not impact the Commission and any other amounts paid to Artswrk.</p>
          </section>

          <section>
            <h2>5. General Terms of Use</h2>
            <p>By agreeing to these Terms, or by using any of our Services, you represent that you are at least the age of majority in your state or province of residence. Minors may use our Services under the supervision of their parents or legal guardians who agree to be bound by these Terms on their behalf. If you are a parent or legal guardian agreeing to these Terms on behalf of a minor, then you are fully responsible for his or her use of the Services, including all liabilities.</p>
            <p>All Users must be in good standing and cannot be an individual that has been previously barred from receiving Artswrk's Services under the laws of any applicable jurisdiction. You may not use our Services for any illegal or unauthorized purpose, nor may you, in using our Services, violate any laws, rules, or regulations in your jurisdiction (including, but not limited to, copyright laws). You also represent and warrant that you are using our Website for your own personal use only, and not for resale, export, re-use, or any other similarly unauthorized use. A breach or violation of any of the Terms may result in an immediate termination of the Services.</p>
            <p>You agree that Artswrk may, without any prior notice, immediately suspend, terminate, discontinue, or limit your use of or access to any of our Services at our sole discretion, for any reason, including but not limited to:</p>
            <ol>
              <li>Any breach or violation of these Terms, or any other incorporated agreement, regulation, or guideline;</li>
              <li>By way of request from law enforcement or any other governmental agencies;</li>
              <li>The discontinuance, alteration, and/or material modification to our Services, or any part thereof;</li>
              <li>Any engagement by you in any acts of fraudulent, misrepresentation, harassment, or illegal activities; and/or</li>
              <li>The non-payment of any associated fees that may be owed by you in connection with your User Account.</li>
            </ol>
            <p>Furthermore, you hereby agree that any and all terminations, suspensions, discontinuances, and or limitations of access for cause shall be made at our sole discretion and that we shall not be held liable by you or any other third party.</p>
            <p>Artswrk reserves the right to refuse Services to anyone, for any reason, at any time, at our own discretion. Artswrk also reserves the right, but does not have the obligation, to pre-screen, refuse, or delete any content currently available through our Website. In addition, we reserve the right to remove and/or delete any such content that would violate these Terms or which would otherwise be considered offensive to other Users.</p>
            <p>You shall be solely responsible for maintaining the secrecy and confidentiality of your password and for all activities that transpire on or with your User Account. It is your responsibility for any act or omission of any third party that accesses your User Account information that, if undertaken by you, would be deemed a violation of these Terms. It shall be your responsibility to notify us immediately if you notice any unauthorized access, use of your User Account, or any other breach of security. Artswrk shall not be held liable for any losses and/or damages arising from any failure to comply with this clause.</p>
          </section>

          <section>
            <h2>6. Content</h2>
            <p>By using our Services and accepting these Terms, you acknowledge and agree that you will not use our Services, or any part thereof, to create, market, or sell a similar product or service in competition with Artswrk. You acknowledge and agree not to reproduce, export, publish, assign, duplicate, copy, sell, resell, lease, license or exploit the Services or any portion thereof.</p>
            <p>Artswrk shall determine in its sole discretion if you are using any of our Services in violation of this clause or any of these Terms, and you agree that you may be subject to copyright violations, damages, or other legal proceedings.</p>
            <p>Artswrk reserves the right, but has no obligation, to modify, update, or discontinue its Services, or any content on the Website (or any part thereof), without notice at any time. Artswrk shall not be liable to you or to any third party for any modification, price change, suspension, or discontinuance of the Services.</p>
            <p>Artswrk shall not be held responsible if information made available on our Website is not accurate, complete, or current. For clarity, you are relying on any information at your own risk.</p>
            <p>You consent to receiving communications from us, including but not limited to, emails, text messages, and/or calls regarding your User Account, purchases, updates to our Services, marketing, advertising, and any other relevant information.</p>
            <p>As a User, you acknowledge, understand, and agree that all information, text, data, photographs, messages, tags, or any other content, whether it is publicly or privately posted and/or transmitted, expressed by you is your sole responsibility. Furthermore, you may not use our Services for any illegal or unauthorized purpose, nor may you, in the use of the Services, violate any laws, rules, or regulations in your jurisdiction. You agree not to make use of our Services for the purpose of any harmful or deceitful conduct, including but not limited to, the following:</p>
            <ol>
              <li>Uploading, posting, transmitting, or otherwise making available any content that shall be deemed, in our discretion, to be harmful, threatening, abusive, harassing, defamatory, offensive, obscene, libelous, or which is hateful, threatening, or otherwise objectionable to any group defined by race, religion, gender, national origin, or sexual orientation, including without limitation to expressions of bigotry, prejudice, racism, or prejudice;</li>
              <li>Causing harm to minors in any manner whatsoever; and/or</li>
              <li>Impersonating Artswrk, or any other individual or entity, or otherwise misrepresenting any affiliation with an individual or entity.</li>
            </ol>
          </section>

          <section>
            <h2>7. Advertising</h2>
            <p>By using our Services, you affirmatively consent that Artswrk may use and share your viewing data with third parties until your consent is withdrawn. Artswrk may track your viewing for its research, analytics, or advertisement serving purposes. It may share such information with:</p>
            <ol>
              <li>"Ad Networks" which are companies that display advertisements to you on our Website;</li>
              <li>"Data Analytics Providers" which are companies that collect and analyze the information collected about you; and</li>
              <li>"Social Networks" which are companies that connect individuals around common interests and facilitate sharing (e.g., Facebook).</li>
            </ol>
            <p><strong>Advertising.</strong> You consent to any advertising or promotional activity that Artswrk or any affiliate of Artswrk engages in. Artswrk reserves the right to engage in Ad Networks and Google advertisements on the Website.</p>
          </section>

          <section>
            <h2>8. Wireless and Location-Based Features; Social Media Plug-ins</h2>
            <p><strong>Wireless Features.</strong> Our Services may offer certain features that are available to you via your wireless device. These features may include the ability to access our Services, upload content, receive messages, and download applications to your wireless device (collectively, "Wireless Features"). Your carrier may prohibit or restrict certain Wireless Features and certain Wireless Features may be incompatible with your carrier or wireless device. In addition, your carrier may charge you for standard messaging, data, and other fees to participate in Wireless Features. Fees and charges may appear on your wireless bill or be deducted from your pre-paid balance. We have no responsibility or liability for any fees or charges you incur when using Wireless Features. You should check with your carrier to find out whether any fees or charges will apply, what plans are available, and how much they cost. You should also contact your carrier with any other questions regarding these issues.</p>
            <p><strong>Terms of Wireless Features.</strong> If you register for any Wireless Features, you agree that, in connection with those Wireless Features, we may send communications to your wireless device regarding us or other parties. Further, we may collect information related to your use of the Wireless Features in accordance with our Privacy Policy. If you have registered via our Services for Wireless Features, then you agree to notify us of any changes to your wireless contact information (including your phone number) and to update your User Account to reflect such changes.</p>
            <p><strong>Location-Based Features.</strong> When you use one of our location-enabled features, we may collect and process information about your actual location. If you have enabled GPS, geo-location, or other location-based features on a device, you acknowledge that your device location may be tracked and may be shared consistent with our Privacy Policy.</p>
            <p>Any location-based services are for individual use only and should not be used or relied on as an emergency locator system, used while driving or operating vehicles, or used in connection with any hazardous environments requiring fail-safe performance, or any other situation in which the failure or inaccuracy of use of the location-based services could lead directly to death, personal injury, or severe physical or property damage. The location-based services are not suited or intended for family finding purposes, fleet tracking, or any other type of business or enterprise use.</p>
            <p><strong>Social Media Plug-Ins.</strong> Social media plug-ins of social networks such as Facebook, LinkedIn, Instagram, Twitter, Pinterest, and Google Plus (among others) may be integrated in our Services. Where our Services contain a plug-in to a social network, such plug-in is clearly marked. If you choose to click on one of these buttons or links, your browser will connect directly to the servers of the relevant social network. The social network directly transmits the content of the plug-in to your browser. If you are registered on the relevant social network and logged into your respective account, the social network receives the information that the web page was used by you. If you interact with a social network plug-in (e.g., you press the Facebook "Like" feature, the Twitter "Tweet this" feature, Google Plus "1+" button, or a similar feature on another social network) or drop a comment on the appropriate web page, the corresponding information is directly transmitted to the relevant social network from your browser. If you are not registered with the social network or you are logged out before you use our Services, there is the possibility that at least your IP address will be submitted to and stored by the social network. If you interact with us through a social media platform, plug-in, etc., then you may be enabling us to have ongoing access to certain information from your social network profile (such as your name, social networking ID page, email address, photo, gender, location, the people/sites you follow, etc.).</p>
            <p>If you don't want a social network to collect the information about you described above, or to share it with us and other third parties, please review the privacy policy of the relevant social network and/or log out of the relevant social network before using our Services. As with other websites, you may be able to delete any existing cookies placed on your computer by the social network via your browser.</p>
          </section>

          <section>
            <h2>9. Pricing</h2>
            <p>Artswrk strives to display accurate price information and acknowledges that we may on occasion make inadvertent typographical errors, inaccuracies, or omissions related to pricing and availability. Artswrk reserves the right to correct any such errors, inaccuracies, or omissions at any time and to cancel any purchases arising from such occurrences. Our Commission and other additional fees for the Services offered will be the price in effect at the time of purchase and will be set out in your order confirmation, email receipt, or other relevant correspondence. Please be advised that taxes and other charges, which may include, but are not limited to: service fees, currency and/or exchange fees, and/or VAT or local taxes may be added to your total cost.</p>
            <p>Any prices, discounts, or promotions that may become available in the future are subject to change without notice. We may offer promotions, discounts, or sales on our Website in our sole discretion to certain individuals ("Promotions"). These Promotions may affect the pricing and may be governed by terms and conditions separate from these Terms. If there is a conflict between the terms and conditions for a Promotion and these Terms, the terms and conditions specific to that Promotion will govern that specific circumstance.</p>
            <p>If in the event that we begin charging for the use of any of our Services and you do not pay the amounts owed when they are due, or your payment method continuously fails, Artswrk may cancel your Services and initiate collection procedures. You agree to pay our cost of collection for any overdue payments, including, without limitation to, reasonable attorney's fees.</p>
          </section>

          <section>
            <h2>10. Termination</h2>
            <p>You may delete or terminate your User Account with Artswrk at any time by providing written notice to our Website Administrator, or by cancelling your User Account directly through the Website. Artswrk will not be responsible or liable for errors made by the User during the ordering or cancellation process.</p>
            <p>Artswrk may terminate your User Account at any time for any reason, particularly due to breach of any of these Terms. Upon termination by either Artswrk or Artist, Artswrk will permit Artist to withdraw any and all payments from Clients in Artist's "wallet", and under certain circumstances, permit Artist to complete any current or pending Jobs. Upon termination by either Artswrk or Client, Client will be obligated to compensate any additional payments owed to Artist for services performed or Jobs completed in accordance with these Terms, as well as any reimbursements to Artist and Commission owed to Artswrk. For the avoidance of doubt, the non-solicitation, non-competition, confidentiality, and intellectual property rights outlined in these Terms shall survive termination.</p>
          </section>

          <section>
            <h2>11. Content Disputes</h2>
            <p>In the event of a dispute with another User of our Website related to or stemming from any User generated content (a "Content Dispute"), you must contact our Website Administrator via email. Our Website Administrator will oversee all claims and complaints issued through our Website and will handle all Content Disputes accordingly.</p>
            <p>We abide by the Digital Millennium Copyright Act (the "DMCA") as it relates to online service providers, like us, being asked to remove material that allegedly violates another's copyright. The DMCA provides recourse for copyright owners who believe that material appearing on the Internet infringes their rights under U.S. copyright law. Artswrk respects others' intellectual property rights and further reserves the right to delete or disable content alleged to be infringing, and to terminate the User Accounts of repeat alleged infringers. In the event of a DMCA violation, please contact our Website Administrator containing the following information:</p>
            <ol>
              <li>A physical or electronic signature of a person authorized to act on behalf of the owner of the copyright that has been allegedly infringed;</li>
              <li>Identification of works or materials being infringed;</li>
              <li>Identification of the material that is claimed to be infringing including information regarding the location of the infringing materials that the copyright owner seeks to have removed, with sufficient detail so that we are capable of finding and verifying its existence;</li>
              <li>Your contact information as the reporter including address, telephone number and email address;</li>
              <li>A statement that you have a good faith belief that the material identified is not authorized by the copyright owner, its agent, or the law; and</li>
              <li>A statement made under penalty of perjury that the information provided is accurate and the reporting party is authorized to make the complaint on behalf of the copyright owner.</li>
            </ol>
            <p><strong>Copyright Infringement Claims.</strong> If you believe in good faith that materials available on the Services infringe your copyright, you (or your agent) may send to Artswrk a written notice by mail, email, or fax, requesting that Artswrk remove such material or block access to it. If you believe in good faith that someone has wrongly filed a notice of copyright infringement against you, the DMCA permits you to send to Artswrk counternotice. Notices and counter-notices must meet the then-current statutory requirements imposed by the DMCA. Visit <a href="https://www.copyright.gov/">https://www.copyright.gov/</a> for additional details.</p>
          </section>

          <section>
            <h2>12. Intellectual Property &amp; Proprietary Rights</h2>
            <p>By using the Website and agreeing to these Terms, you acknowledge and agree that our Website and Services are protected by copyright, trademark, trade secret, or other proprietary and intellectual property laws. You understand and agree that this Section provides for the protection of our Services, our Website, and any other relevant content provided to you which extends beyond federal, state, local or foreign copyright laws or treaties. By using the Website, you agree to be bound by the Terms herein, even where such Terms extend beyond such laws. You are confirming that in the event you attempt to reuse, reproduce, remarket, sell, or create a competitive or derivative product or service for sale, or otherwise use our Services for any similarly unauthorized personal financial gain, you may be subject to legal proceedings.</p>
            <p>Artswrk owns, solely and exclusively, all right, title, and interest in and to the Services and our Website; and all content, software, code, and data therein; the look, feel, design and organization of the Website; and the compilation of the content, code, data, and information on the Website, including but not limited to any intellectual property and proprietary rights. Artswrk reserves all rights in and to the Services not granted expressly to you in these Terms. Nothing shall be construed as granting to you, by implication, estoppel, or otherwise, any license or right to the Services or any of our content.</p>
            <p>If you post, upload, or make available any, information, data, text, files, communications, or other materials regarding our Services and your use of our Services on any other website, blog, article, or social media platform ("Your Content"), you hereby grant Artswrk a perpetual, non-exclusive, irrevocable, royalty-free, sub-licensable, and transferable (in whole or in part), worldwide license to use, reproduce, transmit, display, exhibit, distribute, index, comment on, modify, create derivative works based upon, perform, or otherwise exploit Your Content including your name, image, voice, likeness and/or other biographical information or material in connection with Your Content, in whole or in part, in all media formats and distribution methods now known or hereafter devised in connection with the Services, including but not limited to, advertising, promoting, and marketing the Services, all without further notice to you, with or without attribution, without limitation as to frequency, and without the requirement of any permission from or payment to you or to any other person or entity. You waive any right to inspect or approve Your Content or any use of Your Content. You waive all moral rights to Your Content, which may be available to you in any part of the world and confirm that no such rights have been asserted. None of Your Content will be subject to any obligation on our part, whether of confidentiality, attribution or otherwise, and we will not be liable for any use or disclosure of Your Content. You understand and agree that we may use the public content to develop aggregate ratings, personalize Website views, market products, or identify or feature popular members or Services.</p>
          </section>

          <section>
            <h2>13. Disclaimer of Warranties and Limitation of Liability</h2>
            <p>ALL SERVICES OFFERED ON THE WEBSITE ARE PROVIDED "AS IS" WITHOUT ANY WARRANTY WHATSOEVER, INCLUDING, WITHOUT LIMITATION, ANY: (A) WARRANTY OF MERCHANTABILITY; (B) WARRANTY OF FITNESS FOR A PARTICULAR PURPOSE; OR (C) WARRANTY AGAINST INFRINGEMENT OF INTELLECTUAL PROPERTY RIGHTS OF A THIRD PARTY; WHETHER EXPRESS OR IMPLIED BY LAW, COURSE OF DEALING, COURSE OF PERFORMANCE, USAGE OF TRADE, OR OTHERWISE.</p>
            <p>TO THE FULLEST EXTENT ALLOWED BY APPLICABLE LAW, UNDER NO CIRCUMSTANCES SHALL ARTSWRK BE LIABLE TO YOU OR ANY THIRD PARTY FOR ANY CONSEQUENTIAL, INCIDENTAL, INDIRECT, EXEMPLARY, SPECIAL OR PUNITIVE DAMAGES WHETHER ARISING OUT OF BREACH OF CONTRACT, TORT (INCLUDING NEGLIGENCE), MISREPRESENTATION, RESTITUTION OR OTHERWISE, REGARDLESS OF WHETHER SUCH DAMAGES WERE FORESEEABLE AND WHETHER ARTSWRK HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES, AND NOTWITHSTANDING THE FAILURE OF ANY AGREED OR OTHER REMEDY OF ITS ESSENTIAL PURPOSE.</p>
            <p>OUR SOLE AND ENTIRE MAXIMUM LIABILITY, FOR ANY REASON, AND YOUR SOLE AND EXCLUSIVE REMEDY FOR ANY CAUSE WHATSOEVER, SHALL BE LIMITED TO THE ACTUAL AMOUNT YOU PAID FOR THE SERVICES, IF ANY.</p>
            <p>The limitation of liability set forth above shall: a) only apply to the extent permitted by law; and b) not apply to: (i) liability resulting from our gross negligence or willful misconduct, or (ii) death or bodily injury resulting from our acts or omissions.</p>
            <p><strong>Data Privacy.</strong> You understand that the use of third party servers may involve the transmission of your data over networks that are not owned, operated, or controlled by Artswrk, and that Artswrk is not responsible for any of your lost, altered, or intercepted data, or your data that is stored across any such network. Artswrk cannot guarantee that its security procedures will be error free or that the transmission of data will always be secure.</p>
          </section>

          <section>
            <h2>14. Non-Disparagement</h2>
            <p>You agree not to make or communicate to any person or entity, in any media or public forum, including any social media network, any comments or statements (written or oral) that intentionally or unintentionally, or is reasonably certain to, disparage, create a negative impression of, or is detrimental to the reputation of Artswrk or the Services associated therewith.</p>
          </section>

          <section>
            <h2>15. Non-Compete</h2>
            <p>In no event shall Artswrk be precluded from (a) creating, discussing, reviewing, developing, or licensing for itself or third parties any Services or other activities for other clients and/or artists that are similar to what Artswrk conducts as an online platform for Clients and Artists; or (b) rendering services to businesses or individuals similar to, or that are in competition with, Clients and Artists.</p>
          </section>

          <section>
            <h2>16. No Resell</h2>
            <p>In the event any of the Services, including any bookings, Job postings, deliverables, subscriptions, or materials derived therefrom, are used, copied, or resold to a third party by Artist or Client without a license or otherwise obtaining Artswrk's permission, Artist and Client agrees that they shall (a) not circumvent Artswrk; and (b) provide Artswrk an agreed upon fee or commission. If Artist or Client do not comply with this Section, they may be subject to legal claims including, but not limited to, copyright infringement, plus the cost of all additional damages and attorney's fees. Parties agree that Artswrk shall be compensated for all Services, including any materials derived therefrom or used outside of the parameters set by these Terms.</p>
          </section>

          <section>
            <h2>17. Arbitration</h2>
            <p>If a controversy or claim should arise, the Parties will first attempt in good faith to resolve such controversy or claim by negotiation. If the matter has not been resolved within thirty (30) days by negotiation, the Parties will attempt in good faith to resolve the controversy or claim in accordance with mediation, with mutually agreeable rules. If the matter has not been resolved by mediation within sixty (60) days of the commencement of mediation, or if either Party will not participate in mediation, then the controversy shall be settled by binding arbitration. The written decision of the arbitrator shall be binding arbitration administered by the American Arbitration Association in accordance with the provisions of its Commercial Arbitration Rules and supplementary procedures for consumer related disputes of the American Arbitration Association (the "AAA"), excluding rules or procedures governing or permitting class actions. The Parties agree that there shall be no pre-arbitration discovery and the arbitrator shall not award punitive damages to either of the Parties. Judgment may be entered in any court having jurisdiction.</p>
          </section>

          <section>
            <h2>18. Notices</h2>
            <p>Artswrk may provide any notice to you under these Terms by: (a) sending a message to an email address that you provide; or (b) by posting directly to our Website. Notices sent by email will be effective on the date the email is sent and notices that are posted on our Website will be effective upon posting. It is your responsibility to keep your email address current and review any new notices that are posted.</p>
            <p>To provide us notice under these Terms, you must contact us our Website Administrator by email, personal delivery, overnight courier, or certified mail to the addresses specified herein. Notice by email will be effective on the date the email is sent. Notice provided by personal delivery will be effective immediately. Notice provided by overnight courier will be effective one (1) business day after it is sent. Notice provided by certified mail will be effective three (3) business days after it is sent.</p>
          </section>

          <section>
            <h2>19. Miscellaneous</h2>
            <p><strong>Third Party Content.</strong> The Services may contain links, advertisements, and references to other third party service providers ("Third Party Content"). Artswrk has no control over and is not responsible for any Third Party Content or the actions of those that provide such content. Any information regarding a third party found on our Website does not express or imply that Artswrk endorses or accepts any responsibility or liability for the third party, or vice versa.</p>
            <p><strong>Indemnification.</strong> By using the Services, you agree to indemnify, hold harmless, and defend Artswrk from any claims, damages, losses, liabilities, and all costs and expenses of defense, including, but not limited to, attorney's fees resulting directly or indirectly from a claim by a third party that is based on your use of the Services.</p>
            <p><strong>Privacy Policy.</strong> Artswrk respects your privacy and is committed to protecting it. To learn more please visit our Privacy Policy, which governs the processing of all personal data collected from you in connection with your use of the Services. You acknowledge and consent to the collection and use of your Personal Information by Artswrk for the purpose of using our Services.</p>
            <p><strong>Governing Law and Jurisdiction.</strong> All matters arising out of or relating to these Terms are governed by and construed in accordance with the internal laws of the State of Delaware without giving effect to any choice or conflict of law provision or rule.</p>
            <p><strong>Severability.</strong> If any provision of these Terms is invalid, illegal, void, or unenforceable, then that provision will be deemed severed from these Terms and will not affect the validity or enforceability of the remaining provisions of these Terms.</p>
            <p><strong>Waiver.</strong> Failure by Artswrk to enforce any right or provision of these Terms will not constitute as a waiver of future enforcement of that right or provision. The waiver of any right or provision will be effective only if in writing and signed by a duly authorized representative of Artswrk.</p>
            <p><strong>Force Majeure.</strong> Artswrk will not be liable or responsible to you, nor be deemed to have defaulted or breached these Terms, for any failure or delay in our performance under these Terms when and to the extent such failure or delay is caused by or results from acts or circumstances beyond our reasonable control, including, without limitation, acts of God, flood, fire, earthquake, explosion, governmental actions, war, invasion or hostilities (whether war is declared or not), terrorist threats or acts, riot or other civil unrest, national emergency, revolution, insurrection, epidemic, lockouts, strikes or other labor disputes (whether or not relating to our workforce), or restraints or delays affecting carriers or inability or delay in obtaining supplies of adequate or suitable materials, materials or telecommunication breakdown or power outage.</p>
            <p><strong>Notice to California Users.</strong> Under California Civil Code Section 1789.3, California users of our Services are entitled to the following specific consumer rights notice: The Complaint Assistance Unit of the Division of Consumer Services of the California Department of Consumer Affairs may be contacted in writing at 400 R Street, Suite 1080, Sacramento, California 95814, or by telephone at (916) 445-1254 or (800) 952-5210.</p>
            <p><strong>Notice to New Jersey Clients.</strong> If you are residing in New Jersey, the following provisions of these Terms do not apply to you (and do not limit any rights that you may have) to the extent that they are unenforceable under New Jersey law: (a) the disclaimer of liability for any indirect, incidental, consequential, special, exemplary, or punitive damages of any kind (for example, to the extent unenforceable under the New Jersey Punitive Damages Act, New Jersey Products Liability Act, New Jersey Uniform Commercial Code, and New Jersey Consumer Fraud Act; (b) the limitations of liability for lost profits or loss or misuse of any data (for example, to the extent unenforceable under the New Jersey Identity Theft Protection Act and New Jersey Consumer Fraud Act); (c) application of the limitations of liability to the recovery of damages that arise under contract and tort, including negligence, strict liability, or any other theory (for example, to the extent such damages are recoverable by a consumer under New Jersey law, including the New Jersey Products Liability Act); (d) the requirement that you indemnify Artswrk (for example, to the extent the scope of such indemnity is prohibited under New Jersey law); and (e) the Delaware governing law provision (for example, to the extent that your rights as a consumer residing in New Jersey are required to be governed by New Jersey law.</p>
            <p><strong>Statute of Limitations.</strong> You agree that regardless of any statute or law to the contrary, any claim or cause of action against Artswrk arising out of a related use of the Website, the Services, Resources, Merchandise, Artswrk Shop, or these Terms must be filed within one (1) year after such claim or cause of action arose or be forever barred.</p>
            <p>These Terms and our Privacy Policy shall be deemed the final and integrated agreement between you and Artswrk on the matters contained herein. You may also be subject to additional Terms that may apply if you make a purchase from a third party. You acknowledge and agree that these Terms are binding and shall govern the relationship between Artswrk and you in connection to the use the Services defined herein.</p>
            <p>If you have any questions, please feel free to contact Artswrk's Website Administrator directly at <a href="mailto:contact@artswrk.com">contact@artswrk.com</a>.</p>
          </section>

        </div>

        <div className="border-t border-gray-100 mt-14 pt-8 flex items-center gap-6 text-xs text-gray-400">
          <a href="/terms" className="font-semibold text-[#111]">Terms of Service</a>
          <a href="/privacy-policy" className="hover:text-[#F25722] transition-colors">Privacy Policy</a>
          <a href="/cancellation-policy" className="hover:text-[#F25722] transition-colors">Cancellation Policy</a>
          <span className="ml-auto">{LAST_UPDATED}</span>
        </div>

      </div>

      <style>{`
        .prose-legal section { margin-bottom: 2.5rem; }
        .prose-legal h2 { font-size: 1rem; font-weight: 700; color: #111; margin-bottom: 0.75rem; margin-top: 0; }
        .prose-legal p { font-size: 0.9375rem; color: #4b5563; line-height: 1.8; margin-bottom: 0.875rem; }
        .prose-legal strong { color: #111; font-weight: 600; }
        .prose-legal ul { margin: 0.25rem 0 0.875rem 1.25rem; list-style-type: disc; }
        .prose-legal ul li { font-size: 0.9375rem; color: #4b5563; line-height: 1.8; margin-bottom: 0.25rem; }
        .prose-legal ol { margin: 0.25rem 0 0.875rem 1.5rem; list-style-type: decimal; }
        .prose-legal ol li { font-size: 0.9375rem; color: #4b5563; line-height: 1.8; margin-bottom: 0.375rem; }
        .prose-legal a { color: #F25722; text-decoration: none; }
        .prose-legal a:hover { text-decoration: underline; }
      `}</style>
    </div>
  );
}
