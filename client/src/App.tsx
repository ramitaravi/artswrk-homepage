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
import SimpleDashboard from "./pages/dashboard/SimpleDashboard";
import DashJobs from "./pages/dashboard/DashJobs";
import Bookings from "./pages/dashboard/Bookings";
import Payments from "./pages/dashboard/Payments";
import Artists from "./pages/dashboard/Artists";
import Messages from "./pages/dashboard/Messages";
import CompanyPage from "./pages/dashboard/CompanyPage";
import SubLists from "./pages/dashboard/SubLists";
import Community from "./pages/dashboard/Community";
import Benefits from "./pages/dashboard/Benefits";
import ArtistProfile from "./pages/dashboard/ArtistProfile";
import PostJob from "./pages/PostJob";
import Signup from "./pages/Signup";
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
import MusicSchools from "./pages/MusicSchools";
import DanceTeachers from "./pages/DanceTeachers";
import DanceJudges from "./pages/DanceJudges";
import MusicTeachers from "./pages/MusicTeachers";
import Production from "./pages/Production";
import ClientJobDetail from "./pages/dashboard/ClientJobDetail";
import PublicArtistProfile from "./pages/ArtistProfile";
import LeadsOverview from "./pages/leads/LeadsOverview";
import LeadsContacts from "./pages/leads/LeadsContacts";
import LeadsLists from "./pages/leads/LeadsLists";
import LeadsCampaigns from "./pages/leads/LeadsCampaigns";
import LeadsUnsubscribes from "./pages/leads/LeadsUnsubscribes";
import LeadsCRM from "./pages/leads/LeadsCRM";
import LeadsFacebook from "./pages/leads/LeadsFacebook";
import { useAuth } from "./_core/hooks/useAuth";
import ImpersonationBanner from "./components/ImpersonationBanner";

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

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Home} />
      <Route path="/jobs" component={Jobs} />
      {/* Job detail pages — PRO route MUST come before generic slug routes */}
      <Route path="/jobs/pro/:companySlug/:jobSlug" component={ProJobDetail} />
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
      <Route path="/signup" component={Signup} />
      <Route path="/client-onboarding" component={ClientOnboarding} />
      <Route path="/artist-onboarding" component={ArtistOnboarding} />
      <Route path="/join" component={Join} />
      {/* Legacy artist-only join — still works if linked directly */}
      <Route path="/join/artist" component={ArtistJoin} />
      <Route path="/about" component={About} />
      <Route path="/dance-competitions" component={DanceCompetitions} />
      <Route path="/dance-studios" component={DanceStudios} />
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

      {/* Simple dashboard — enterprise-style layout experiment */}
      <Route path="/app/simple">
        {() => <AppRoute clientComponent={SimpleDashboard} />}
      </Route>

      {/* Jobs: artists see job feed + applications, clients see their postings */}
      <Route path="/app/jobs">
        {() => <AppRoute clientComponent={DashJobs} />}
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
        {() => <DashRoute component={Community} />}
      </Route>
      <Route path="/app/benefits">
        {() => <DashRoute component={Benefits} />}
      </Route>

      {/* Artist-only routes (rendered inside ArtistDashboard via URL matching) */}
      <Route path="/app/profile">
        {() => <AppRoute />}
      </Route>
      <Route path="/app/pro-jobs">
        {() => <AppRoute />}
      </Route>
      <Route path="/app/settings">
        {() => <AppRoute />}
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

      {/* Enterprise dashboard — job-level deep link must come before the base route */}
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
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
