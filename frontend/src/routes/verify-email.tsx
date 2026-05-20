import { createFileRoute, useNavigate, useSearch, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ErrorMessage, formatApiError } from "@/components/ErrorMessage";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { LoadingSpinner } from "@/components/LoadingSpinner";

interface VerifyEmailSearch {
  email?: string;
}

export const Route = createFileRoute("/verify-email")({
  head: () => ({ meta: [{ title: "Verify your email — NoorConnect" }] }),
  validateSearch: (search: Record<string, unknown>): VerifyEmailSearch => ({
    email: typeof search.email === "string" ? search.email : undefined,
  }),
  component: VerifyEmail,
});

function VerifyEmail() {
  const { email } = useSearch({ from: "/verify-email" });
  const navigate = useNavigate();
  const { setSession, user, loading } = useAuth();

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  if (loading) return <LoadingSpinner label="Checking session..." />;
  if (user) return <Navigate to={user.role === "teacher" ? "/dashboard/teacher" : "/dashboard/student"} />;

  // Tick the resend cooldown down to 0 once a second.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // The backend already sent a code when /auth/register/ succeeded. Start the
  // resend countdown so the user can't immediately spam "Resend".
  useEffect(() => {
    setCooldown(60);
  }, []);

  if (!email) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Missing email</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn't tell which account you're verifying. Please sign up or log in again.
        </p>
        <Link to="/login" className="mt-4 inline-block text-primary font-medium">
          Go to login
        </Link>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (code.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.post("auth/verify-email/", { email, code });
      const data = res.data?.data ?? res.data;
      setSession({ access: data?.access, refresh: data?.refresh, user: data?.user });
      const role = data?.user?.role;
      await navigate({ to: role === "teacher" ? "/dashboard/teacher" : "/dashboard/student" });
    } catch (e: any) {
      setError(
        formatApiError(
          e.response?.data?.detail ?? e.response?.data?.error,
          "Verification failed. Please check the code and try again.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = async () => {
    setError(null);
    setInfo(null);
    try {
      await api.post("auth/resend-code/", { email });
      setInfo("A new code has been sent. Check your inbox.");
      setCooldown(60);
    } catch (e: any) {
      const retry = e.response?.data?.retry_after;
      if (typeof retry === "number") setCooldown(retry);
      setError(
        formatApiError(
          e.response?.data?.detail ?? e.response?.data?.error,
          "Couldn't resend the code. Please try again in a moment.",
        ),
      );
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-xl border border-border bg-card p-8 shadow-sm text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <Mail className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-2xl font-bold">Verify your email</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>.
          Enter it below to activate your account.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={code} onChange={(v) => setCode(v)}>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} className="h-12 w-12 text-lg" />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <ErrorMessage message={error} />
          {info && !error && (
            <p className="text-sm text-success">{info}</p>
          )}

          <button
            type="submit"
            disabled={submitting || code.length !== 6}
            className="w-full rounded-md bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary-dark disabled:opacity-50"
          >
            {submitting ? "Verifying..." : "Verify"}
          </button>
        </form>

        <div className="mt-6 text-sm text-muted-foreground">
          Didn't get it?{" "}
          {cooldown > 0 ? (
            <span className="text-foreground/60">Resend in {cooldown}s</span>
          ) : (
            <button
              type="button"
              onClick={onResend}
              className="text-primary font-medium hover:underline"
            >
              Resend code
            </button>
          )}
        </div>

        <div className="mt-3 text-xs text-muted-foreground">
          Wrong email?{" "}
          <Link to="/register/student" className="text-primary font-medium hover:underline">
            Start over
          </Link>
        </div>
      </div>
    </div>
  );
}
