import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
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
import SubLists from "./pages/dashboard/SubLists";
import Community from "./pages/dashboard/Community";
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

  // auth.me returns the full User row — userRole and enterprise are on it directly
  const isArtist = (user as any)?.userRole === "Artist";
  const isEnterprise = !!(user as any)?.enterprise;

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

  // Enterprise users belong on /enterprise, not the regular dashboard
  if (isEnterprise) {
    window.location.replace("/enterprise");
    return null;
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
  const isArtist = (user as any)?.userRole === "Artist";

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
  const isArtist = (user as any)?.userRole === "Artist";

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
 * Community is a client-only feature for now — artists get redirected
 * back to their dashboard instead of a "coming soon" placeholder.
 */
function CommunityRoute() {
  const { user, loading } = useAuth();
  const isArtist = (user as any)?.userRole === "Artist";

  if (loading) return <DashboardLayout><div /></DashboardLayout>;

  if (isArtist) {
    window.location.replace("/app");
    return null;
  }

  return (
    <DashboardLayout>
      <Community />
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
      <Route path="/app/lists">
        {() => <DashRoute component={SubLists} />}
      </Route>
      <Route path="/app/community">
        {() => <CommunityRoute />}
      </Route>
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

      {/* /subscribe/basic and /subscribe/pro are referenced as upgrade CTAs
          (Jobs.tsx paywall + banner) but never had a matching route — real
          checkout lives in the Settings > Subscription tab, which already
          defaults to showing it. */}
      <Route path="/subscribe/basic">
        {() => { window.location.replace("/app/settings"); return null; }}
      </Route>
      <Route path="/subscribe/pro">
        {() => { window.location.replace("/app/settings"); return null; }}
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
