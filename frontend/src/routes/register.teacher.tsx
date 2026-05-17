import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ErrorMessage, formatApiError } from "@/components/ErrorMessage";

export const Route = createFileRoute("/register/teacher")({
  head: () => ({ meta: [{ title: "Become a Teacher — NoorConnect" }] }),
  component: RegisterTeacher,
});

const SUBJECTS = ["Noorani Qaida", "Nazra", "Tajweed", "Hifz", "Islamic Studies"];

type Mode = "online" | "inperson" | "both";

interface TeacherData {
  full_name: string;
  email: string;
  password: string;
  phone: string;
  city: string;
  gender: "male" | "female";
  subjects: string[];
  teaching_mode: Mode;
  years_experience: number;
  hourly_rate: number;
  languages: string;
  bio: string;
  profile_photo: File | null;
  certificate: File | null;
  cnic: File | null;
}

function RegisterTeacher() {
  const { setSession } = useAuth();
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [data, setData] = useState<TeacherData>({
    full_name: "",
    email: "",
    password: "",
    phone: "",
    city: "Lahore",
    gender: "male",
    subjects: [],
    teaching_mode: "online",
    years_experience: 1,
    hourly_rate: 1000,
    languages: "Urdu, English",
    bio: "",
    profile_photo: null,
    certificate: null,
    cnic: null,
  });

  const update = <K extends keyof TeacherData>(k: K, v: TeacherData[K]) =>
    setData((d) => ({ ...d, [k]: v }));
  const toggle = (k: "subjects", v: string) =>
    setData((d) => ({ ...d, [k]: d[k].includes(v) ? d[k].filter((x) => x !== v) : [...d[k], v] }));

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const reg = await api.post("auth/register/", {
        role: "teacher",
        full_name: data.full_name,
        email: data.email,
        password: data.password,
        phone: data.phone,
        city: data.city,
      });
      const regData = reg.data?.data ?? reg.data;
      // Atomic: persist tokens + set user + clear loading in one batch so
      // the teachers/apply request that follows is authenticated and any
      // ProtectedRoute we later land on doesn't flash "Checking session...".
      setSession({ access: regData?.access, refresh: regData?.refresh, user: regData?.user });

      const fd = new FormData();
      fd.append("bio", data.bio);
      fd.append("gender", data.gender);
      fd.append("teaching_mode", data.teaching_mode);
      fd.append("years_experience", String(data.years_experience));
      fd.append("hourly_rate", String(data.hourly_rate));
      fd.append("city", data.city);
      data.subjects.forEach((s) => fd.append("subjects", s));
      data.languages
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((l) => fd.append("languages", l));
      if (data.profile_photo) fd.append("profile_photo", data.profile_photo);
      if (data.certificate) fd.append("certificate", data.certificate);
      if (data.cnic) fd.append("cnic", data.cnic);

      await api.post("teachers/apply/", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setDone(true);
    } catch (e: any) {
      setError(
        formatApiError(
          e.response?.data?.detail ?? e.response?.data?.error,
          "Submission failed. Please verify your inputs.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <CheckCircle2 className="h-16 w-16 text-success mx-auto" />
        <h1 className="mt-4 text-2xl font-bold">Application Submitted</h1>
        <p className="mt-2 text-muted-foreground">
          Our team will review your documents within 24-48 hours. You'll receive an email when your
          account is approved.
        </p>
        <Link
          to="/"
          className="mt-6 inline-block rounded-md bg-primary px-5 py-2.5 text-primary-foreground font-semibold"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">Become a NoorConnect Teacher</h1>
      <p className="text-sm text-muted-foreground mt-1">Complete the 3-step application below.</p>

      <div className="mt-6 flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex-1 flex items-center gap-2">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
            >
              {s}
            </div>
            <div className={`h-1 flex-1 rounded ${step > s ? "bg-primary" : "bg-secondary"}`} />
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card p-6 space-y-4">
        {step === 1 && (
          <>
            <h2 className="font-semibold text-lg">Personal Information</h2>
            <Input label="Full name" value={data.full_name} onChange={(v) => update("full_name", v)} />
            <Input label="Email" type="email" value={data.email} onChange={(v) => update("email", v)} />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Password"
                type="password"
                value={data.password}
                onChange={(v) => update("password", v)}
              />
              <Input label="Phone" value={data.phone} onChange={(v) => update("phone", v)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="City">
                <select
                  value={data.city}
                  onChange={(e) => update("city", e.target.value)}
                  className={ic}
                >
                  {["Lahore", "Karachi", "Islamabad", "Multan", "Peshawar"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Gender">
                <select
                  value={data.gender}
                  onChange={(e) => update("gender", e.target.value as TeacherData["gender"])}
                  className={ic}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </Field>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="font-semibold text-lg">Teaching Details</h2>
            <Field label="Subjects taught">
              <div className="flex flex-wrap gap-2">
                {SUBJECTS.map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => toggle("subjects", s)}
                    className={`px-3 py-1.5 rounded-full text-sm border ${data.subjects.includes(s) ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Teaching mode">
              <select
                value={data.teaching_mode}
                onChange={(e) => update("teaching_mode", e.target.value as Mode)}
                className={ic}
              >
                <option value="online">Online</option>
                <option value="inperson">In-person</option>
                <option value="both">Both</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Experience (years)"
                type="number"
                value={data.years_experience}
                onChange={(v) => update("years_experience", Number(v))}
              />
              <Input
                label="Hourly rate (PKR)"
                type="number"
                value={data.hourly_rate}
                onChange={(v) => update("hourly_rate", Number(v))}
              />
            </div>
            <Input
              label="Languages spoken (comma-separated)"
              value={data.languages}
              onChange={(v) => update("languages", v)}
            />
            <Field label="Bio / about yourself">
              <textarea
                rows={4}
                value={data.bio}
                onChange={(e) => update("bio", e.target.value)}
                className={ic}
              />
            </Field>
            <Field label="Profile photo">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => update("profile_photo", e.target.files?.[0] ?? null)}
              />
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="font-semibold text-lg">Verification</h2>
            <Field label="Certificate / qualification (PDF or image)">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => update("certificate", e.target.files?.[0] ?? null)}
              />
            </Field>
            <Field label="CNIC or government ID (image)">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => update("cnic", e.target.files?.[0] ?? null)}
              />
            </Field>
          </>
        )}

        <ErrorMessage message={error} />

        <div className="flex justify-between pt-2">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="rounded-md border border-input px-4 py-2 text-sm"
            >
              Back
            </button>
          ) : (
            <span />
          )}
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
            >
              Next
            </button>
          ) : (
            <button
              disabled={submitting}
              onClick={submit}
              className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Application"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const ic =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      {children}
    </div>
  );
}
function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <Field label={label}>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={ic}
      />
    </Field>
  );
}
