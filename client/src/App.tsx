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
import ArtistProfile from "./pages/dashboard/ArtistProfile";
import PostJob from "./pages/PostJob";
import Signup from "./pages/Signup";
import ArtistJoin from "./pages/ArtistJoin";
import Admin from "./pages/Admin";
import Enterprise from "./pages/Enterprise";
import ArtistDashboard from "./pages/ArtistDashboard";
import ArtistProfilePage from "./pages/artist/ArtistProfilePage";
import JobDetail from "./pages/JobDetail";
import ProJobDetail from "./pages/ProJobDetail";
import ApplyPage from "./pages/ApplyPage";
import About from "./pages/About";
import DanceCompetitions from "./pages/DanceCompetitions";
import DanceStudios from "./pages/DanceStudios";
import MusicSchools from "./pages/MusicSchools";
import DanceTeachers from "./pages/DanceTeachers";
import DanceJudges from "./pages/DanceJudges";
import MusicTeachers from "./pages/MusicTeachers";
import Production from "./pages/Production";
import { useAuth } from "./_core/hooks/useAuth";
import { trpc } from "./lib/trpc";

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
 * Artists see ArtistDashboard (URL-driven content); clients see their dedicated pages.
 * Accepts an optional clientComponent override — falls back to Overview for the home route.
 */
function AppRoute({ clientComponent: ClientComponent = Overview }: { clientComponent?: React.ComponentType }) {
  const { user } = useAuth();
  const { data: artswrkUser } = trpc.artswrkUsers.getByEmail.useQuery(
    { email: user?.email ?? "" },
    { enabled: !!user?.email }
  );

  // While loading, render the layout skeleton (DashboardLayout shows its own spinner)
  const isArtist = artswrkUser?.userRole === "Artist";

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
      {/* Job detail pages — PRO route MUST come before the generic :locationSlug route */}
      <Route path="/jobs/pro/:companySlug/:jobSlug" component={ProJobDetail} />
      {/* Apply route MUST come before the generic :jobSlug route */}
      <Route path="/jobs/:locationSlug/:jobSlug/apply" component={ApplyPage} />
      <Route path="/jobs/:locationSlug/:jobSlug" component={JobDetail} />
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/post-job/success" component={PostJob} />
      <Route path="/post-job" component={PostJob} />
      <Route path="/signup" component={Signup} />
      <Route path="/join" component={ArtistJoin} />
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

      {/* Jobs: artists see job feed + applications, clients see their postings */}
      <Route path="/app/jobs">
        {() => <AppRoute clientComponent={DashJobs} />}
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
        {() => <AppRoute clientComponent={Community} />}
      </Route>
      <Route path="/app/benefits">
        {() => <AppRoute clientComponent={Benefits} />}
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

      {/* Enterprise landing page */}
      <Route path="/enterprise" component={Enterprise} />

      {/* Admin — separate path, admin-only */}
      <Route path="/admin-dashboard" component={Admin} />
      {/* Legacy /admin redirect */}
      <Route path="/admin">
        {() => { window.location.replace("/admin-dashboard"); return null; }}
      </Route>

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
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
