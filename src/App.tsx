import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { SettingsProvider } from "@/hooks/useSettings";
import { AuthGuard, AdminGuard, GuestGuard } from "@/guards/RouteGuards";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

// Pages
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AuthCallback from "./pages/AuthCallback";
import Dashboard from "./pages/Dashboard";
import NewProject from "./pages/NewProject";
import ProductAnalysis from "./pages/ProductAnalysis";
import ConceptSelection from "./pages/ConceptSelection";
import ScriptRender from "./pages/ScriptRender";
import Account from "./pages/Account";
import AdminSettings from "./pages/AdminSettings";
import NotFound from "./pages/NotFound";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <SettingsProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<GuestGuard><Login /></GuestGuard>} />
              <Route path="/signup" element={<GuestGuard><Signup /></GuestGuard>} />
              <Route path="/forgot-password" element={<GuestGuard><ForgotPassword /></GuestGuard>} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              {/* Authenticated — Dashboard layout */}
              <Route element={<AuthGuard><DashboardLayout /></AuthGuard>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/projects/new" element={<NewProject />} />
                <Route path="/projects/:projectId/analysis" element={<ProductAnalysis />} />
                <Route path="/projects/:projectId/concepts" element={<ConceptSelection />} />
                <Route path="/projects/:projectId/script" element={<ScriptRender />} />
                <Route path="/account" element={<Account />} />
              </Route>

              {/* Admin — Dashboard layout + admin guard */}
              <Route element={<AdminGuard><DashboardLayout /></AdminGuard>}>
                <Route path="/admin/settings" element={<AdminSettings />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </SettingsProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
