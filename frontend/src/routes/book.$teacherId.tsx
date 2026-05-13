import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import api from "@/lib/api";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorMessage } from "@/components/ErrorMessage";

export const Route = createFileRoute("/book/$teacherId")({
  head: () => ({ meta: [{ title: "Book a Session — NoorConnect" }] }),
  component: () => <ProtectedRoute role="student"><BookPage /></ProtectedRoute>,
});

interface Teacher {
  id: string | number;
  full_name?: string;
  subjects?: string[];
  hourly_rate?: number;
  avatar?: string;
}

const FALLBACK: Teacher = { id: "1", full_name: "Ustadh Ahmed Khan", subjects: ["Tajweed","Hifz","Nazra"], hourly_rate: 1200 };

const SLOTS = ["3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM"];

function BookPage() {
  const { teacherId } = Route.useParams();
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState<Teacher>(FALLBACK);
  const [type, setType] = useState<"trial" | "regular">("trial");
  const [subject, setSubject] = useState<string>("Tajweed");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState<string>(SLOTS[0]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get(`teachers/${teacherId}/`).then((r) => {
      const t = r.data?.data ?? r.data;
      if (t) { setTeacher(t); if (t.subjects?.[0]) setSubject(t.subjects[0]); }
    }).catch(() => {});
  }, [teacherId]);

  const confirm = async () => {
    setSubmitting(true); setError(null);
    try {
      await api.post("bookings/create/", { teacher: teacherId, type, subject, date, time });
      setSuccess(true);
    } catch (e: any) {
      setError(e.response?.data?.detail ?? "Booking failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <CheckCircle2 className="h-16 w-16 text-success mx-auto" />
        <h1 className="mt-4 text-2xl font-bold">Booking Confirmed!</h1>
        <p className="mt-2 text-muted-foreground">A Google Meet link has been sent to your email and is available in your dashboard.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link to="/dashboard/student" className="rounded-md bg-primary px-5 py-2.5 text-primary-foreground font-semibold">Go to Dashboard</Link>
          <button onClick={() => navigate({ to: "/teachers" })} className="rounded-md border border-input px-5 py-2.5">Find more teachers</button>
        </div>
      </div>
    );
  }

  const price = type === "trial" ? 0 : teacher.hourly_rate ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
          {teacher.full_name?.charAt(0)}
        </div>
        <div className="flex-1">
          <p className="font-semibold">{teacher.full_name}</p>
          <p className="text-xs text-muted-foreground">{teacher.subjects?.join(" · ")}</p>
        </div>
        <p className="text-sm font-semibold">Rs. {teacher.hourly_rate}/hr</p>
      </div>

      <div className="mt-6 space-y-6">
        <Section title="1. Session type">
          <div className="grid grid-cols-2 gap-3">
            {(["trial","regular"] as const).map((t) => (
              <button key={t} onClick={() => setType(t)}
                className={`rounded-lg border p-4 text-left ${type === t ? "border-primary bg-primary/5" : "border-border"}`}>
                <p className="font-semibold capitalize">{t === "trial" ? "Free Trial" : "Regular Session"}</p>
                <p className="text-xs text-muted-foreground mt-1">{t === "trial" ? "30 mins · Free" : `60 mins · Rs. ${teacher.hourly_rate}`}</p>
              </button>
            ))}
          </div>
        </Section>

        <Section title="2. Select subject">
          <div className="flex flex-wrap gap-2">
            {(teacher.subjects ?? []).map((s) => (
              <button key={s} onClick={() => setSubject(s)}
                className={`px-3 py-1.5 rounded-full text-sm border ${subject === s ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>{s}</button>
            ))}
          </div>
        </Section>

        <Section title="3. Pick a date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
        </Section>

        <Section title="4. Pick a time slot">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {SLOTS.map((s) => (
              <button key={s} onClick={() => setTime(s)}
                className={`rounded-md border py-2 text-sm ${time === s ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>{s}</button>
            ))}
          </div>
        </Section>

        <Section title="5. Confirm">
          <div className="rounded-lg bg-surface p-4 text-sm space-y-1">
            <Row k="Teacher" v={teacher.full_name ?? ""} />
            <Row k="Subject" v={subject} />
            <Row k="Date & time" v={`${date} at ${time}`} />
            <Row k="Type" v={type === "trial" ? "Free Trial" : "Regular"} />
            <div className="border-t border-border pt-2 mt-2 flex justify-between font-semibold">
              <span>Total</span><span>{price === 0 ? "Free" : `Rs. ${price.toLocaleString()}`}</span>
            </div>
          </div>
        </Section>

        <ErrorMessage message={error} />

        <button disabled={submitting} onClick={confirm}
          className="w-full rounded-md bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary-dark disabled:opacity-50">
          {submitting ? "Booking..." : "Confirm Booking"}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-semibold mb-3">{title}</h3>
      {children}
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>;
}
