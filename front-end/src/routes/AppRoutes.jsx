import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "@/layouts/MainLayout";
import ProtectedRoute from "./ProtectedRoute";
import { PATHS } from "./paths";

// Pages
import HomePage from "@/pages/public/HomePage";
import SearchResultsPage from "@/pages/public/SearchResultsPage";
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import VerifyEmailPage from "@/pages/auth/VerifyEmailPage";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage";
import EventDetailPage from "@/pages/events/EventDetailPage";
import RealtimeEventDetailsPage from "@/pages/events/RealtimeEventDetailsPage";
import CreateEventPage from "@/pages/admin/CreateEventPage";
import MyEventPage from "@/pages/admin/MyEventPage";
import MyTicketPage from "@/pages/user/MyTicketPage";
import AccountPage from "@/pages/user/AccountPage";
import PaymentPage from "@/pages/payment/PaymentPage";
import PaymentDonePage from "@/pages/payment/PaymentDonePage";
import PaymentFailPage from "@/pages/payment/PaymentFailPage";
import PaymentResultPage from "@/pages/payment/PaymentResultPage";
import PaymentErr from "@/pages/payment/PaymentErr";

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public routes wrapped with MainLayout (Header + Outlet + Footer) */}
      <Route element={<MainLayout />}>
        <Route path={PATHS.HOME} element={<HomePage />} />
        <Route path={PATHS.SEARCH} element={<SearchResultsPage />} />
        <Route path={PATHS.EVENT_DETAILS} element={<EventDetailPage />} />

        {/* User protected routes inside MainLayout */}
        <Route element={<ProtectedRoute />}>
          <Route path={PATHS.USER_TICKETS} element={<MyTicketPage />} />
          <Route path={PATHS.USER_ACCOUNT} element={<AccountPage />} />
          <Route path={PATHS.ADMIN_MY_EVENTS} element={<MyEventPage />} />
        </Route>
      </Route>

      {/* Auth routes */}
      <Route path={PATHS.LOGIN} element={<LoginPage />} />
      <Route path={PATHS.REGISTER} element={<RegisterPage />} />
      <Route path={PATHS.VERIFY_EMAIL} element={<VerifyEmailPage />} />
      <Route path={PATHS.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
      <Route path={PATHS.RESET_PASSWORD} element={<ResetPasswordPage />} />

      {/* Admin event creation protected route */}
      <Route element={<ProtectedRoute />}>
        <Route path={PATHS.ADMIN_CREATE_EVENT} element={<CreateEventPage />} />
      </Route>

      {/* Legacy /test route aliases redirecting seamlessly to protected routes */}
      <Route
        path={PATHS.ADMIN_CREATE_EVENT_TEST}
        element={<Navigate to={PATHS.ADMIN_CREATE_EVENT} replace />}
      />
      <Route
        path={PATHS.USER_TICKETS_TEST}
        element={<Navigate to={PATHS.USER_TICKETS} replace />}
      />

      {/* Booking & Payment routes */}
      <Route path={PATHS.EVENT_SEATS} element={<RealtimeEventDetailsPage />} />
      <Route path={PATHS.PAYMENT} element={<PaymentPage />} />
      <Route path={PATHS.PAYMENT_DONE} element={<PaymentDonePage />} />
      <Route path={PATHS.PAYMENT_FAIL} element={<PaymentFailPage />} />
      <Route path={PATHS.PAYMENT_RESULT} element={<PaymentResultPage />} />
      <Route path={PATHS.PAYMENT_ERROR} element={<PaymentErr />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to={PATHS.HOME} replace />} />
    </Routes>
  );
};

export default AppRoutes;
