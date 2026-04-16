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

// DashboardLayout handles auth protection internally (redirects to /login if not authenticated)
function DashRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <DashboardLayout>
      <Component />
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
      <Route path="/about" component={About} />
      <Route path="/dance-competitions" component={DanceCompetitions} />
      <Route path="/dance-studios" component={DanceStudios} />
      <Route path="/music-schools" component={MusicSchools} />
      <Route path="/dance-teachers" component={DanceTeachers} />
      <Route path="/dance-judges" component={DanceJudges} />
      <Route path="/music-teachers" component={MusicTeachers} />
      <Route path="/production" component={Production} />

      {/* Dashboard routes — auth protection is inside DashboardLayout */}
      <Route path="/dashboard">
        {() => <DashRoute component={Overview} />}
      </Route>
      <Route path="/dashboard/jobs">
        {() => <DashRoute component={DashJobs} />}
      </Route>
      <Route path="/dashboard/bookings">
        {() => <DashRoute component={Bookings} />}
      </Route>
      <Route path="/dashboard/payments">
        {() => <DashRoute component={Payments} />}
      </Route>
      <Route path="/dashboard/artists">
        {() => <DashRoute component={Artists} />}
      </Route>
      <Route path="/dashboard/artists/:artistId">
        {(params) => (
          <DashboardLayout>
            <ArtistProfile />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/dashboard/messages">
        {() => <DashRoute component={Messages} />}
      </Route>
      <Route path="/dashboard/company">
        {() => <DashRoute component={CompanyPage} />}
      </Route>
      <Route path="/dashboard/sublists">
        {() => <DashRoute component={SubLists} />}
      </Route>
      <Route path="/dashboard/community">
        {() => <DashRoute component={Community} />}
      </Route>
      <Route path="/dashboard/benefits">
        {() => <DashRoute component={Benefits} />}
      </Route>

      {/* Enterprise Dashboard */}
      <Route path="/enterprise" component={Enterprise} />

      {/* Artist Dashboard */}
      <Route path="/artist-dashboard" component={ArtistDashboard} />
      <Route path="/artist/profile" component={ArtistProfilePage} />

      {/* Admin */}
      <Route path="/admin" component={Admin} />

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
