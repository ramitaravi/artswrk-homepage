import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Jobs from "./pages/Jobs";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import DashboardLayout from "./components/DashboardLayout";
import Overview from "./pages/dashboard/Overview";
import DashJobs from "./pages/dashboard/DashJobs";
import Bookings from "./pages/dashboard/Bookings";
import Payments from "./pages/dashboard/Payments";
import Artists from "./pages/dashboard/Artists";
import Messages from "./pages/dashboard/Messages";
import CompanyPage from "./pages/dashboard/CompanyPage";
// Hidden for launch — see the redirected routes below.
// import SubLists from "./pages/dashboard/SubLists";
// import Community from "./pages/dashboard/Community";
import Benefits from "./pages/dashboard/Benefits";
import BrowseCompanies from "./pages/dashboard/BrowseCompanies";
import ArtistProfile from "./pages/dashboard/ArtistProfile";
import PostJob from "./pages/PostJob";
import Join from "./pages/Join";
import ClientOnboarding from "./pages/ClientOnboarding";
import ArtistOnboarding from "./pages/ArtistOnboarding";
import ArtistJoin from "./pages/ArtistJoin";
import Admin from "./pages/Admin";
import Enterprise from "./pages/Enterprise";
import ArtistDashboard from "./pages/ArtistDashboard";
import ArtistProfilePage from "./pages/artist/ArtistProfilePage";
import JobDetail from "./pages/JobDetail";
import ProJobDetail from "./pages/ProJobDetail";
import ApplyPage from "./pages/ApplyPage";
import About from "./pages/About";
import InvoicePayment from "./pages/InvoicePayment";
import DanceCompetitions from "./pages/DanceCompetitions";
import DanceStudios from "./pages/DanceStudios";
import AcrobaticArts from "./pages/AcrobaticArts";
import MusicSchools from "./pages/MusicSchools";
import DanceTeachers from "./pages/DanceTeachers";
import DanceJudges from "./pages/DanceJudges";
import MusicTeachers from "./pages/MusicTeachers";
import Production from "./pages/Production";
import Terms from "./pages/Terms";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import CancellationPolicy from "./pages/CancellationPolicy";
import ClientJobDetail from "./pages/dashboard/ClientJobDetail";
import ClientBookingDetail from "./pages/dashboard/ClientBookingDetail";
import Settings from "./pages/dashboard/Settings";
import PublicArtistProfile from "./pages/ArtistProfile";
import PublicCompanyPage from "./pages/PublicCompanyPage";
import LeadsOverview from "./pages/leads/LeadsOverview";
import LeadsContacts from "./pages/leads/LeadsContacts";
import LeadsLists from "./pages/leads/LeadsLists";
import LeadsCampaigns from "./pages/leads/LeadsCampaigns";
import LeadsUnsubscribes from "./pages/leads/LeadsUnsubscribes";
import LeadsCRM from "./pages/leads/LeadsCRM";
import LeadsFacebook from "./pages/leads/LeadsFacebook";
import BrowseArtists from "./pages/BrowseArtists";
import { useAuth } from "./_core/hooks/useAuth";
import { useEffect, useRef } from "react";
import { useUpgrade } from "@/lib/useUpgrade";
import ImpersonationBanner from "./components/ImpersonationBanner";
import CheckoutSessionVerifier from "./components/CheckoutSessionVerifier";

// DashboardLayout handles auth protection internally (redirects to /login if not authenticated)
function DashRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <DashboardLayout>
      <Component />
    </DashboardLayout>
  );
}

/**
 * Role-aware /app route dispatcher.
 * auth.me returns the full DB User object — userRole and enterprise are available immediately,
 * no secondary query needed. Using a secondary lookup caused a race where the client dashboard
 * flashed (or stuck) while the second query was in flight.
 */
function AppRoute({ clientComponent: ClientComponent = Overview }: { clientComponent?: React.ComponentType }) {
  const { user, loading } = useAuth();

  // auth.me returns the full User row — planTier is on it directly. Its
  // prefix (artist_ / client_ / enterprise_) is the single source of truth
  // for which dashboard to show, replacing the old userRole + enterprise
  // boolean pair.
  const planTier = (user as any)?.planTier as string | undefined;
  const isArtist = planTier?.startsWith("artist_") ?? false;
  const isEnterprise = planTier?.startsWith("enterprise_") ?? false;

  // Wait for auth before making routing decisions to avoid a wrong-dashboard flash
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-6 h-6 border-2 border-[#F25722] border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  // Enterprise accounts see the Enterprise dashboard right at /app, same as
  // everyone else — no more bouncing to a separate /enterprise URL. Rendered
  // unwrapped (no DashboardLayout) since Enterprise manages its own full-page
  // chrome, same as it always has at the standalone /enterprise route (which
  // still exists too, untouched — Enterprise's own internal navigation to
  // /enterprise/:jobId for job deep-links still resolves correctly there).
  if (isEnterprise) {
    return <Enterprise />;
  }

  return (
    <DashboardLayout>
      {isArtist ? <ArtistDashboard /> : <ClientComponent />}
    </DashboardLayout>
  );
}

/**
 * Artists see the full Jobs feed embedded inside the dashboard sidebar.
 * Clients see their own job postings (DashJobs).
 */
function ArtistJobsRoute() {
  const { user, loading } = useAuth();
  const isArtist = ((user as any)?.planTier as string | undefined)?.startsWith("artist_") ?? false;

  if (loading) {
    return (
      <DashboardLayout fullHeight>
        <div className="flex items-center justify-center h-full">
          <div className="w-6 h-6 border-2 border-[#F25722] border-t-transparent rounded-full animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isArtist) {
    return (
      <DashboardLayout>
        <DashJobs />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout fullHeight>
      <Jobs inDashboard />
    </DashboardLayout>
  );
}

/**
 * Browse Companies is an artist-only PRO feature — clients get redirected
 * back to their dashboard instead of a page that doesn't apply to them.
 */
function BrowseCompaniesRoute() {
  const { user, loading } = useAuth();
  const isArtist = ((user as any)?.planTier as string | undefined)?.startsWith("artist_") ?? false;

  if (loading) return <DashboardLayout><div /></DashboardLayout>;

  if (!isArtist) {
    window.location.replace("/app");
    return null;
  }

  return (
    <DashboardLayout>
      <BrowseCompanies />
    </DashboardLayout>
  );
}


/**
 * `/jobs` and `/pro` are public browsing routes with their own standalone
 * navbar, meant for logged-out visitors. A logged-in user landing here
 * (e.g. via an old link or bookmark) should get the real dashboard chrome —
 * sidebar nav, not the marketing navbar — so send them to the /app equivalent.
 */
function PublicJobsRoute({ pro = false }: { pro?: boolean }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return null;

  if (isAuthenticated) {
    window.location.replace(pro ? "/app/pro-jobs" : "/app/jobs");
    return null;
  }

  return <Jobs />;
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Home} />
      <Route path="/jobs">{() => <PublicJobsRoute />}</Route>
      <Route path="/pro">{() => <PublicJobsRoute pro />}</Route>
      {/* PRO job detail — must come before /pro list route */}
      <Route path="/pro/:jobSlug" component={ProJobDetail} />
      {/* New simplified URL: /jobs/:jobSlug and /jobs/:jobSlug/apply */}
      <Route path="/jobs/:jobSlug/apply" component={ApplyPage} />
      <Route path="/jobs/:jobSlug" component={JobDetail} />
      {/* Legacy two-segment URLs — kept for backward compat, JobDetail redirects to canonical */}
      <Route path="/jobs/:locationSlug/:legacyJobSlug/apply" component={ApplyPage} />
      <Route path="/jobs/:locationSlug/:legacyJobSlug" component={JobDetail} />
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/post-job/success" component={PostJob} />
      <Route path="/post-job" component={PostJob} />
      {/* /signup redirects to /join for any old external links */}
      <Route path="/signup">{() => { window.location.replace("/join"); return null; }}</Route>
      <Route path="/client-onboarding" component={ClientOnboarding} />
      <Route path="/artist-onboarding" component={ArtistOnboarding} />
      <Route path="/join" component={Join} />
      {/* Legacy artist-only join — still works if linked directly */}
      <Route path="/join/artist" component={ArtistJoin} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy-policy" component={PrivacyPolicy} />
      <Route path="/cancellation-policy" component={CancellationPolicy} />
      <Route path="/about" component={About} />
      <Route path="/browse" component={BrowseArtists} />
      <Route path="/dance-competitions" component={DanceCompetitions} />
      <Route path="/dance-studios" component={DanceStudios} />
      <Route path="/acrobatic-arts" component={AcrobaticArts} />
      <Route path="/music-schools" component={MusicSchools} />
      <Route path="/dance-teachers" component={DanceTeachers} />
      <Route path="/dance-judges" component={DanceJudges} />
      <Route path="/music-teachers" component={MusicTeachers} />
      <Route path="/production" component={Production} />

      {/* ── /app/* — shared path for all logged-in users (artist + client) ── */}
      {/* Home: artists see their overview, clients see hiring stats */}
      <Route path="/app">
        {() => <AppRoute clientComponent={Overview} />}
      </Route>

      {/* Jobs: artists see the full job feed inside the dashboard, clients see their postings */}
      <Route path="/app/jobs">
        {() => <ArtistJobsRoute />}
      </Route>

      {/* Client job detail — shared with enterprise */}
      <Route path="/app/jobs/:jobId">
        {() => (
          <DashboardLayout>
            <ClientJobDetail />
          </DashboardLayout>
        )}
      </Route>

      {/* Enterprise job detail */}
      <Route path="/app/enterprise/jobs/:jobId">
        {() => (
          <DashboardLayout>
            <ClientJobDetail />
          </DashboardLayout>
        )}
      </Route>

      {/* Bookings: artists see their engagements, clients see confirmed bookings */}
      <Route path="/app/bookings">
        {() => <AppRoute clientComponent={Bookings} />}
      </Route>

      {/* Client booking detail — a real page instead of the old inline expand */}
      <Route path="/app/bookings/:bookingId">
        {() => (
          <DashboardLayout>
            <ClientBookingDetail />
          </DashboardLayout>
        )}
      </Route>

      {/* Payments: artists see earnings, clients see billing */}
      <Route path="/app/payments">
        {() => <AppRoute clientComponent={Payments} />}
      </Route>

      {/* Messages: shared inbox — same component works for both roles */}
      <Route path="/app/messages">
        {() => <AppRoute clientComponent={Messages} />}
      </Route>

      {/* Client-only routes */}
      <Route path="/app/artists">
        {() => <DashRoute component={Artists} />}
      </Route>
      <Route path="/app/artists/:artistId">
        {() => (
          <DashboardLayout>
            <ArtistProfile />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/app/company">
        {() => <DashRoute component={CompanyPage} />}
      </Route>
      {/* Sub Lists and Community are hidden for launch — neither feature is
          finished. They were reachable by URL with no gate of any kind, so the
          routes redirect rather than just being dropped from the nav. Restore
          these two blocks alongside their nav entries in DashboardLayout when
          the features ship. */}
      <Route path="/app/lists">{() => <Redirect to="/app" />}</Route>
      <Route path="/app/community">{() => <Redirect to="/app" />}</Route>
      <Route path="/app/benefits">
        {() => <DashRoute component={Benefits} />}
      </Route>
      <Route path="/app/companies">
        {() => <BrowseCompaniesRoute />}
      </Route>

      {/* Artist-only routes (rendered inside ArtistDashboard via URL matching) */}
      <Route path="/app/profile">
        {() => <AppRoute />}
      </Route>
      <Route path="/app/pro-jobs">
        {() => <ArtistJobsRoute />}
      </Route>
      <Route path="/app/settings">
        {() => <AppRoute clientComponent={Settings} />}
      </Route>

      {/* /subscribe/* is where a logged-out artist lands after joining, via
          /join?next=/subscribe/pro. It used to dump them on the settings page
          to start over; now it finishes the thing they clicked. */}
      <Route path="/subscribe/basic">
        {() => <SubscribeRedirect tier="basic" />}
      </Route>
      <Route path="/subscribe/pro">
        {() => <SubscribeRedirect tier="pro" />}
      </Route>

      {/* Legacy redirects — old /dashboard/* paths → /app/* */}
      <Route path="/dashboard">
        {() => { window.location.replace("/app"); return null; }}
      </Route>
      <Route path="/dashboard/:rest*">
        {(params) => {
          const rest = (params as any).rest || "";
          window.location.replace(`/app/${rest}`);
          return null;
        }}
      </Route>
      <Route path="/artist-dashboard">
        {() => { window.location.replace("/app"); return null; }}
      </Route>

      {/* Public artist profile page */}
      <Route path="/book/:slug" component={PublicArtistProfile} />
      <Route path="/studio/:userId" component={PublicCompanyPage} />
      <Route path="/studio/:userId/:companyId" component={PublicCompanyPage} />

      {/* Enterprise dashboard — job-level deep link must come before the base route */}
      <Route path="/enterprise/messages">
        {() => { window.location.replace("/app/messages"); return null; }}
      </Route>
      <Route path="/enterprise/:jobId">
        {(params) => <Enterprise initialJobId={parseInt((params as any).jobId)} />}
      </Route>
      <Route path="/enterprise">{() => <Enterprise />}</Route>

      {/* Admin — separate path, admin-only */}
      <Route path="/admin-dashboard" component={Admin} />

      {/* Leads Dashboard — standalone admin-only CRM powered by Brevo */}
      <Route path="/leads" component={LeadsOverview} />
      <Route path="/leads/facebook" component={LeadsFacebook} />
      <Route path="/leads/contacts" component={LeadsContacts} />
      <Route path="/leads/lists" component={LeadsLists} />
      <Route path="/leads/campaigns" component={LeadsCampaigns} />
      <Route path="/leads/unsubscribes" component={LeadsUnsubscribes} />
      <Route path="/leads/crm" component={LeadsCRM} />

      {/* Legacy /admin redirect */}
      <Route path="/admin">
        {() => { window.location.replace("/admin-dashboard"); return null; }}
      </Route>

      {/* Public invoice payment page */}
      <Route path="/invoice/:token" component={InvoicePayment} />

      {/* Fallback */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

/**
 * Sends an artist straight into Stripe for the tier they asked for.
 *
 * The only way here is /join?next=/subscribe/pro — they clicked "Get PRO"
 * while logged out, made an account, and came back. Making them find the
 * button a second time loses people who had already decided.
 */
function SubscribeRedirect({ tier }: { tier: "basic" | "pro" }) {
  const { user, loading } = useAuth();
  const { start } = useUpgrade();
  const fired = useRef(false);

  useEffect(() => {
    if (loading || fired.current) return;
    if (!user) { window.location.replace(`/login?next=/subscribe/${tier}`); return; }
    fired.current = true;
    start({ audience: "artist", tier, returnPath: "/app" });
  }, [loading, user, tier, start]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-gray-400">Opening checkout…</p>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <ImpersonationBanner />
          <CheckoutSessionVerifier />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
