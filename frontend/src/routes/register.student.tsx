import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ErrorMessage } from "@/components/ErrorMessage";

export const Route = createFileRoute("/register/student")({
  head: () => ({ meta: [{ title: "Sign Up as Student — NoorConnect" }] }),
  component: RegisterStudent,
});

interface FormValues {
  full_name: string;
  email: string;
  password: string;
  confirm: string;
  phone: string;
  city: string;
  for_self: "self" | "child";
  child_name?: string;
  child_age?: number;
  terms: boolean;
}

function RegisterStudent() {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({ defaultValues: { for_self: "self" } });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const forSelf = watch("for_self");

  const onSubmit = async (v: FormValues) => {
    setError(null);
    if (v.password !== v.confirm) { setError("Passwords do not match"); return; }
    if (!v.terms) { setError("Please accept the terms"); return; }
    setSubmitting(true);
    try {
      const res = await api.post("auth/register/", {
        role: "student",
        full_name: v.full_name,
        email: v.email,
        password: v.password,
        phone: v.phone,
        city: v.city,
        is_learning_for_child: v.for_self === "child",
        child_name: v.for_self === "child" ? v.child_name : "",
        child_age: v.for_self === "child" ? v.child_age : null,
      });
      const data = res.data?.data ?? res.data;
      if (data?.access) localStorage.setItem("access_token", data.access);
      if (data?.refresh) localStorage.setItem("refresh_token", data.refresh);
      if (data?.user) setUser(data.user);
      navigate({ to: "/dashboard/student" });
    } catch (e: any) {
      setError(e.response?.data?.detail ?? e.response?.data?.error ?? "Registration failed. Please check your details and the API connection.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-bold">Create your student account</h1>
        <p className="text-sm text-muted-foreground mt-1">Start learning the Quran with verified teachers.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <Field label="Full name" error={errors.full_name?.message}>
            <input {...register("full_name", { required: "Required" })} className={inputCls} />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <input type="email" {...register("email", { required: "Required" })} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Password" error={errors.password?.message}>
              <input type="password" {...register("password", { required: "Required", minLength: { value: 8, message: "Min 8 chars" } })} className={inputCls} />
            </Field>
            <Field label="Confirm password">
              <input type="password" {...register("confirm", { required: true })} className={inputCls} />
            </Field>
          </div>
          <Field label="Phone number">
            <input {...register("phone", { required: "Required" })} className={inputCls} />
          </Field>
          <Field label="City">
            <select {...register("city", { required: true })} className={inputCls}>
              {["Lahore","Karachi","Islamabad","Multan","Peshawar","Other"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Who is learning?">
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="radio" value="self" {...register("for_self")} /> Myself (adult)</label>
              <label className="flex items-center gap-2"><input type="radio" value="child" {...register("for_self")} /> My child</label>
            </div>
          </Field>
          {forSelf === "child" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Child's name">
                <input {...register("child_name")} className={inputCls} />
              </Field>
              <Field label="Child's age">
                <input type="number" min={3} max={17} {...register("child_age", { valueAsNumber: true })} className={inputCls} />
              </Field>
            </div>
          )}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" {...register("terms")} className="mt-1" />
            I accept the Terms of Service and Privacy Policy.
          </label>
          <ErrorMessage message={error} />
          <button
            disabled={submitting}
            className="w-full rounded-md bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary-dark disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Account"}
          </button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account? <Link to="/login" className="text-primary font-medium">Login</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
