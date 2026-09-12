import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import LoadingSpinner from "@/components/common/LoadingSpinner";
import { PATHS } from "./paths";

const ProtectedRoute = ({ children, redirectTo = PATHS.LOGIN }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner text="Đang xác thực thông tin..." fullPage />;
  }

  if (!isAuthenticated) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`${redirectTo}?returnTo=${returnUrl}`} replace />;
  }

  return children ? children : <Outlet />;
};

export default ProtectedRoute;
