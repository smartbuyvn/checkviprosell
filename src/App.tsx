import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { SettingsProvider } from "@/hooks/useSettings";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { AuthGuard, AdminGuard, GuestGuard } from "@/guards/RouteGuards";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ROUTES } from "@/constants/routes";

/**
 * Nap trang theo nhu cau.
 *
 * Truoc day 21 trang nam chung mot khoi 243 KB gzip: mo trang chu cung tai luon
 * Admin Settings, wizard tao du an va bang dieu khien doi tac. Tach ra thi khach
 * chi tai phan minh thuc su mo.
 *
 * Landing va NotFound van nap san: do la trang vao dau tien, nap theo nhu cau se
 * them mot vong mang ngay truoc khi ve duoc gi len man hinh.
 */
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const NewProject = lazy(() => import("./pages/NewProject"));
const ProductAnalysis = lazy(() => import("./pages/ProductAnalysis"));
const ConceptSelection = lazy(() => import("./pages/ConceptSelection"));
const ScriptRender = lazy(() => import("./pages/ScriptRender"));
const Account = lazy(() => import("./pages/Account"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const Billing = lazy(() => import("./pages/Billing"));
const Affiliate = lazy(() => import("./pages/Affiliate"));
const ScenePreview = lazy(() => import("./pages/ScenePreview"));
const ShopeeToVideo = lazy(() => import("./pages/tools/ShopeeToVideo"));
const ImagesToVideo = lazy(() => import("./pages/tools/ImagesToVideo"));

// Pages
import Landing from "./pages/Landing";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <SettingsProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            {/* Trang nap theo nhu cau can mot man hinh cho trong luc tai khoi ma.
                Khong co Suspense thi React nem loi thay vi hien gi do. */}
            {/* Bat loi luc render de man hinh khong trang tron.
                Dat TRONG BrowserRouter de nut "Tai lai"/"Ve Dashboard" dung duoc. */}
            <ErrorBoundary khuVuc="trang">
            <Suspense fallback={<div className="min-h-screen" />}>
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
            </Suspense>
            </ErrorBoundary>
          </BrowserRouter>
        </SettingsProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

console.log('Force Cache Bust v3');
export default App;

