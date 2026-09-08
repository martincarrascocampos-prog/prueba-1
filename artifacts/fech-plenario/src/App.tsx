import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthGuard } from "@/lib/auth-guard";
import Login from "@/pages/login";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminSessionDetail from "@/pages/admin/session-detail";
import AdminMembers from "@/pages/admin/members";
import AdminHistory from "@/pages/admin/history";
import MemberDashboard from "@/pages/member/dashboard";
import MemberVote from "@/pages/member/vote";
import MemberHistory from "@/pages/member/history";
import Settings from "@/pages/settings";
import Help from "@/pages/help";
import ForgotPassword from "@/pages/forgot-password";
import PublicHome from "@/pages/public-home";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Realtime (Socket.io) is the instant path; polling is only a fallback.
      // Disabling focus refetch avoids refetch storms when ~200 attendees
      // switch tabs during a session. Reconnect refetch closes gaps after a
      // network blip; a short staleTime de-dupes bursts of identical fetches.
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: 10_000,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Switch>
            <Route path="/login" component={Login} />
            <Route path="/forgot-password" component={ForgotPassword} />
            
            <Route path="/admin">
              <AuthGuard allowedRole="admin"><AdminDashboard /></AuthGuard>
            </Route>
            <Route path="/admin/sessions/:id">
              <AuthGuard allowedRole="admin"><AdminSessionDetail /></AuthGuard>
            </Route>
            <Route path="/admin/members">
              <AuthGuard allowedRole="admin"><AdminMembers /></AuthGuard>
            </Route>
            <Route path="/admin/history">
              <AuthGuard allowedRole="admin"><AdminHistory /></AuthGuard>
            </Route>
            
            <Route path="/member">
              <AuthGuard allowedRole="miembro"><MemberDashboard /></AuthGuard>
            </Route>
            <Route path="/member/vote/:topicId">
              <AuthGuard allowedRole="miembro"><MemberVote /></AuthGuard>
            </Route>
            <Route path="/member/history">
              <AuthGuard allowedRole="miembro"><MemberHistory /></AuthGuard>
            </Route>
            
            <Route path="/settings">
              <AuthGuard><Settings /></AuthGuard>
            </Route>
            <Route path="/ayuda">
              <AuthGuard><Help /></AuthGuard>
            </Route>
            
            <Route path="/" component={PublicHome} />
            
            <Route>
              <div className="flex h-screen items-center justify-center">No encontrado</div>
            </Route>
          </Switch>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
