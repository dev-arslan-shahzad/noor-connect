import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { LoadingSpinner } from "./LoadingSpinner";

export function ProtectedRoute({ children, role }: { children: ReactNode; role?: "student" | "teacher" }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner label="Checking session..." />;
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to={user.role === "teacher" ? "/dashboard/teacher" : "/dashboard/student"} />;
  return <>{children}</>;
}
