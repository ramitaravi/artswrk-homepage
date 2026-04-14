import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Jobs from "./pages/Jobs";
import Login from "./pages/Login";
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
      <Route path="/login" component={Login} />
      <Route path="/post-job/success" component={PostJob} />
      <Route path="/post-job" component={PostJob} />
      <Route path="/signup" component={Signup} />

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
