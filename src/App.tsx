import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { SettingsProvider } from "@/hooks/useSettings";
import { AuthGuard, AdminGuard, GuestGuard } from "@/guards/RouteGuards";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ROUTES } from "@/constants/routes";

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
import Billing from "./pages/Billing";
import Affiliate from "./pages/Affiliate";
import ScenePreview from "./pages/ScenePreview";
import ShopeeToVideo from "./pages/tools/ShopeeToVideo";
import ImagesToVideo from "./pages/tools/ImagesToVideo";

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
              <Route path={ROUTES.LANDING} element={<Landing />} />
              <Route path={ROUTES.SCENE_PREVIEW} element={<ScenePreview />} /> {/* Phase 1 QA — no auth needed */}
              <Route path={ROUTES.LOGIN} element={<GuestGuard><Login /></GuestGuard>} />
              <Route path={ROUTES.SIGNUP} element={<GuestGuard><Signup /></GuestGuard>} />
              <Route path={ROUTES.FORGOT_PASSWORD} element={<GuestGuard><ForgotPassword /></GuestGuard>} />
              <Route path={ROUTES.RESET_PASSWORD} element={<ResetPassword />} />
              <Route path={ROUTES.AUTH_CALLBACK} element={<AuthCallback />} />
              <Route path={ROUTES.TERMS} element={<TermsOfService />} />
              <Route path={ROUTES.PRIVACY} element={<PrivacyPolicy />} />

              {/* Authenticated — Dashboard layout */}
              <Route element={<AuthGuard><DashboardLayout /></AuthGuard>}>
                <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
                <Route path={ROUTES.NEW_PROJECT} element={<NewProject />} />
                <Route path={ROUTES.PROJECT_ANALYSIS} element={<ProductAnalysis />} />
                <Route path={ROUTES.PROJECT_CONCEPTS} element={<ConceptSelection />} />
                <Route path={ROUTES.PROJECT_SCRIPT} element={<ScriptRender />} />
                <Route path={ROUTES.TOOLS_SHOPEE} element={<ShopeeToVideo />} />
                <Route path={ROUTES.TOOLS_IMAGES} element={<ImagesToVideo />} />
                <Route path={ROUTES.BILLING} element={<Billing />} />
                <Route path={ROUTES.AFFILIATE} element={<Affiliate />} />
                <Route path={ROUTES.ACCOUNT} element={<Account />} />
              </Route>

              {/* Admin — Dashboard layout + admin guard */}
              <Route element={<AdminGuard><DashboardLayout /></AdminGuard>}>
                <Route path={ROUTES.ADMIN_SETTINGS} element={<AdminSettings />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </SettingsProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

console.log('Force Cache Bust v3');
export default App;

