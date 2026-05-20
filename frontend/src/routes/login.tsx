import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ErrorMessage, formatApiError } from "@/components/ErrorMessage";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Login — NoorConnect" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"student" | "teacher">("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <LoadingSpinner label="Checking session..." />;
  if (user) return <Navigate to={user.role === "teacher" ? "/dashboard/teacher" : "/dashboard/student"} />;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSubmitting(true);
    try {
      const user = await login(email, password);
      navigate({ to: user.role === "teacher" ? "/dashboard/teacher" : "/dashboard/student" });
    } catch (e: any) {
      // Backend returns 403 with detail: {code: "email_not_verified", email, message}
      // when the account exists but hasn't verified its email yet. Send the user
      // to the verify page (the backend already triggered a fresh code if the
      // resend cooldown allowed it).
      const detail = e.response?.data?.detail;
      if (detail && typeof detail === "object" && detail.code === "email_not_verified") {
        navigate({ to: "/verify-email", search: { email: detail.email ?? email } });
        return;
      }
      setError(
        formatApiError(
          detail ?? e.response?.data?.error,
          "Invalid email or password.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">N</div>
          <h1 className="mt-3 text-2xl font-bold">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Login to continue your Quran journey.</p>
        </div>

        <div className="mt-6 grid grid-cols-2 rounded-md bg-secondary p-1 text-sm">
          {(["student", "teacher"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded py-2 font-medium capitalize ${tab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>
              {t}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <ErrorMessage message={error} />
          <button disabled={submitting} className="w-full rounded-md bg-primary py-2.5 font-semibold text-primary-foreground hover:bg-primary-dark disabled:opacity-50">
            {submitting ? "Signing in..." : "Login"}
          </button>
          {tab === "teacher" && (
            <button type="button" className="w-full rounded-md border border-input py-2.5 text-sm font-medium hover:bg-accent">
              Continue with Google
            </button>
          )}
          <div className="text-sm text-center text-muted-foreground">
            <a href="#" className="text-primary hover:underline">Forgot password?</a>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to={tab === "teacher" ? "/register/teacher" : "/register/student"} className="text-primary font-medium">Sign up</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
