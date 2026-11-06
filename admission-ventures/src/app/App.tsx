import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { BarChart3, BookOpen, ClipboardList, CreditCard, FileQuestion, GraduationCap, LayoutDashboard, Megaphone, ScrollText, User, Users } from "lucide-react";
import { supabaseConfigured } from "@/lib/supabase/client";
import { ToastProvider } from "@/components/Toast";
import { PageLoader } from "@/components/ui";
import { PublicLayout } from "@/layouts/PublicLayout";
import { DashboardLayout, type NavItem } from "@/layouts/DashboardLayout";
import { AuthProvider } from "./AuthProvider";
import { RequireAdmin, RequireAuth } from "./guards";
import HomePage from "@/pages/public/HomePage";
import CatalogPage from "@/pages/public/CatalogPage";
import CourseDetailPage from "@/pages/public/CourseDetailPage";
import AboutPage from "@/pages/public/AboutPage";
import { ContactPage, NotFoundPage, PrivacyPage, TeamPage, TermsPage } from "@/pages/public/StaticPages";
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from "@/pages/auth/AuthPages";

// Admin and exam screens are split out so students never download admin code.
const MfaPage = lazy(() => import("@/pages/auth/MfaPage"));
const AdminReports = lazy(() => import("@/pages/admin/AdminReports"));
const AdminCourses = lazy(() => import("@/pages/admin/AdminCourses"));
const AdminCourseContent = lazy(() => import("@/pages/admin/AdminCourseContent"));
const AdminStudents = lazy(() => import("@/pages/admin/AdminStudents"));
const AdminOrders = lazy(() => import("@/pages/admin/AdminOrders"));
const AdminQuestions = lazy(() => import("@/pages/admin/AdminQuestions"));
const AdminQuizzes = lazy(() => import("@/pages/admin/AdminQuizzes"));
const AdminAudit = lazy(() => import("@/pages/admin/AdminAudit"));
const AdminAnnouncements = lazy(() => import("@/pages/admin/AdminAnnouncements"));
const named = <T extends Record<string, React.ComponentType>>(loader: () => Promise<T>, key: keyof T) => lazy(async () => ({ default: (await loader())[key] }));
const Dashboard = named(() => import("@/pages/student/StudentPages"), "DashboardPage");
const Orders = named(() => import("@/pages/student/StudentPages"), "OrdersPage");
const Profile = named(() => import("@/pages/student/StudentPages"), "ProfilePage");
const CoursePlayerHome = named(() => import("@/pages/student/LearnPages"), "CoursePlayerHome");
const LessonPage = named(() => import("@/pages/student/LearnPages"), "LessonPage");
const Checkout = named(() => import("@/pages/student/CheckoutPages"), "CheckoutPage");
const PaymentResult = named(() => import("@/pages/student/CheckoutPages"), "PaymentResultPage");
const QuizList = named(() => import("@/pages/student/QuizPages"), "QuizListPage");
const QuizTake = named(() => import("@/pages/student/QuizPages"), "QuizTakePage");
const QuizResult = named(() => import("@/pages/student/QuizPages"), "QuizResultPage");

const studentNav: NavItem[] = [
  { to: "/dashboard", label: "Home", icon: <LayoutDashboard className="h-5 w-5" />, end: true },
  { to: "/courses", label: "Catalogue", icon: <BookOpen className="h-5 w-5" /> },
  { to: "/exams", label: "Exams", icon: <ClipboardList className="h-5 w-5" /> },
  { to: "/orders", label: "Orders", icon: <CreditCard className="h-5 w-5" /> },
  { to: "/profile", label: "Profile", icon: <User className="h-5 w-5" /> },
];
const adminNav: NavItem[] = [
  { to: "/admin", label: "Reports", icon: <BarChart3 className="h-5 w-5" />, end: true },
  { to: "/admin/courses", label: "Courses", icon: <GraduationCap className="h-5 w-5" /> },
  { to: "/admin/students", label: "Students", icon: <Users className="h-5 w-5" /> },
  { to: "/admin/orders", label: "Orders", icon: <CreditCard className="h-5 w-5" /> },
  { to: "/admin/questions", label: "Questions", icon: <FileQuestion className="h-5 w-5" /> },
  { to: "/admin/exams", label: "Exams", icon: <ClipboardList className="h-5 w-5" /> },
  { to: "/admin/announcements", label: "News", icon: <Megaphone className="h-5 w-5" /> },
  { to: "/admin/audit", label: "Audit", icon: <ScrollText className="h-5 w-5" /> },
];

function SetupNotice() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-2xl">Setup needed</h1>
      <p className="mt-2 text-ink-soft">This build is missing <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>. Add them in the Cloudflare Pages project settings (or a local <code>.env</code> file) and rebuild.</p>
    </div>
  );
}

export default function App() {
  if (!supabaseConfigured) return <SetupNotice />;
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route element={<PublicLayout />}>
                <Route index element={<HomePage />} />
                <Route path="courses" element={<CatalogPage />} />
                <Route path="courses/:slug" element={<CourseDetailPage />} />
                <Route path="about" element={<AboutPage />} />
                <Route path="contact" element={<ContactPage />} />
                <Route path="team" element={<TeamPage />} />
                <Route path="terms" element={<TermsPage />} />
                <Route path="privacy" element={<PrivacyPage />} />
                <Route path="login" element={<LoginPage />} />
                <Route path="register" element={<RegisterPage />} />
                <Route path="forgot-password" element={<ForgotPasswordPage />} />
                <Route path="reset-password" element={<ResetPasswordPage />} />
                <Route path="auth/mfa" element={<RequireAuth><MfaPage /></RequireAuth>} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
              <Route element={<RequireAuth><DashboardLayout items={studentNav} area="Student" /></RequireAuth>}>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="orders" element={<Orders />} />
                <Route path="profile" element={<Profile />} />
                <Route path="checkout/:courseId" element={<Checkout />} />
                <Route path="payment/result" element={<PaymentResult />} />
                <Route path="learn/:slug" element={<CoursePlayerHome />} />
                <Route path="learn/:slug/lessons/:lessonId" element={<LessonPage />} />
                <Route path="exams" element={<QuizList />} />
                <Route path="exams/:quizId/take" element={<QuizTake />} />
                <Route path="exams/result/:attemptId" element={<QuizResult />} />
              </Route>
              <Route path="admin" element={<RequireAdmin><DashboardLayout items={adminNav} area="Admin" /></RequireAdmin>}>
                <Route index element={<AdminReports />} />
                <Route path="courses" element={<AdminCourses />} />
                <Route path="courses/:courseId/content" element={<AdminCourseContent />} />
                <Route path="students" element={<AdminStudents />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="questions" element={<AdminQuestions />} />
                <Route path="exams" element={<AdminQuizzes />} />
                <Route path="announcements" element={<AdminAnnouncements />} />
                <Route path="audit" element={<AdminAudit />} />
                <Route path="*" element={<Navigate to="/admin" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
