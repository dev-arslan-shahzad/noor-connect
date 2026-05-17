import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { LoadingSpinner } from "./LoadingSpinner";

export function ProtectedRoute({ children, role }: { children: ReactNode; role?: "student" | "teacher" }) {
  const { user, loading } = useAuth();
  // If we already have a user (just registered/logged in), skip straight through.
  if (user) {
    if (role && user.role !== role) {
      return <Navigate to={user.role === "teacher" ? "/dashboard/teacher" : "/dashboard/student"} />;
    }
    return <>{children}</>;
  }
  // No user yet. Only show the "Checking session..." spinner if there is actually
  // a token in localStorage being verified — otherwise loading=true is just the
  // initial SSR/hydration default and we should send the visitor to /login
  // instead of leaving them on an indefinite spinner.
  const hasToken = typeof window !== "undefined" && !!localStorage.getItem("access_token");
  if (loading && hasToken) return <LoadingSpinner label="Checking session..." />;
  return <Navigate to="/login" />;
}
