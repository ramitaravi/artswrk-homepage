import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
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

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect to="/login" />;
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

      {/* Dashboard routes (protected) */}
      <Route path="/dashboard">
        {() => <ProtectedRoute component={Overview} />}
      </Route>
      <Route path="/dashboard/jobs">
        {() => <ProtectedRoute component={DashJobs} />}
      </Route>
      <Route path="/dashboard/bookings">
        {() => <ProtectedRoute component={Bookings} />}
      </Route>
      <Route path="/dashboard/payments">
        {() => <ProtectedRoute component={Payments} />}
      </Route>
      <Route path="/dashboard/artists">
        {() => <ProtectedRoute component={Artists} />}
      </Route>
      <Route path="/dashboard/messages">
        {() => <ProtectedRoute component={Messages} />}
      </Route>
      <Route path="/dashboard/company">
        {() => <ProtectedRoute component={CompanyPage} />}
      </Route>
      <Route path="/dashboard/sublists">
        {() => <ProtectedRoute component={SubLists} />}
      </Route>
      <Route path="/dashboard/community">
        {() => <ProtectedRoute component={Community} />}
      </Route>
      <Route path="/dashboard/benefits">
        {() => <ProtectedRoute component={Benefits} />}
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
      <AuthProvider>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
