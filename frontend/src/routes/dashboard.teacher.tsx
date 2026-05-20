import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  DollarSign,
  GraduationCap,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  User as UserIcon,
  Users,
  Video,
} from "lucide-react";
import api, { normalizeTeacher, unwrap, unwrapList } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorMessage } from "@/components/ErrorMessage";
import { BookingStatusBadge } from "@/components/BookingStatusBadge";

export const Route = createFileRoute("/dashboard/teacher")({
  head: () => ({ meta: [{ title: "Teacher Dashboard — NoorConnect" }] }),
  component: () => (
    <ProtectedRoute role="teacher">
      <TeacherDashboard />
    </ProtectedRoute>
  ),
});

interface Booking {
  id: number;
  session_id?: number | null;
  teacher_id?: number;
  teacher_name?: string;
  student_id?: number;
  student_name?: string;
  subject?: string;
  session_type?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  status?: string;
  meet_link?: string;
  price?: string;
}

interface TeacherProfile {
  id: number;
  bio?: string;
  gender?: string;
  teaching_mode?: string;
  years_experience?: number;
  hourly_rate?: string | number;
  languages?: string[];
  subjects?: string[];
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
  verification_status?: "pending" | "verified" | "rejected";
  rejection_reason?: string;
  is_featured?: boolean;
  average_rating?: number;
  total_reviews?: number;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtTime(t?: string) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hh = Number(h);
  const ampm = hh >= 12 ? "PM" : "AM";
  const display = ((hh + 11) % 12) + 1;
  return `${display}:${m} ${ampm}`;
}

function TeacherDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<"overview" | "schedule" | "students" | "profile">("overview");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pull all the teacher's bookings + their profile.
  useEffect(() => {
    api
      .get("bookings/")
      .then((r) => setBookings(unwrapList<Booking>(r)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoadingProfile(true);
    api
      .get("teachers/me/")
      .then((r) => setProfile(unwrap<TeacherProfile>(r)))
      .catch(() => setProfile(null))
      .finally(() => setLoadingProfile(false));
  }, [user]);

  // Stats derived from real bookings
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const completed = bookings.filter((b) => b.status === "completed");
    const upcoming = bookings.filter((b) => b.status === "upcoming");
    const distinctStudents = new Set(bookings.map((b) => b.student_id)).size;
    const monthSessions = bookings.filter((b) => {
      if (!b.date) return false;
      const d = new Date(b.date);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    }).length;
    const earnings = completed.reduce((sum, b) => sum + Number(b.price ?? 0), 0);
    return {
      total: bookings.length,
      upcoming: upcoming.length,
      completed: completed.length,
      students: distinctStudents,
      thisMonth: monthSessions,
      earnings,
    };
  }, [bookings]);

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const todaysBookings = bookings.filter((b) => b.date === todayKey && b.status === "upcoming");

  // Group upcoming bookings by weekday for the schedule grid (next 7 days).
  const weekSchedule = useMemo(() => {
    const buckets: Record<string, Booking[]> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = [];
    }
    for (const b of bookings) {
      if (b.status !== "upcoming" || !b.date) continue;
      if (buckets[b.date]) buckets[b.date].push(b);
    }
    return Object.entries(buckets).map(([date, bs]) => {
      const d = new Date(date);
      return { date, dayName: DAY_NAMES[d.getDay()], dayNum: d.getDate(), bookings: bs };
    });
  }, [bookings]);

  // Distinct students roll-up
  const studentRollup = useMemo(() => {
    const map = new Map<number, { name: string; sessions: number; lastDate?: string }>();
    for (const b of bookings) {
      if (!b.student_id) continue;
      const existing = map.get(b.student_id) ?? { name: b.student_name ?? "Student", sessions: 0 };
      existing.sessions += 1;
      if (!existing.lastDate || (b.date && b.date > existing.lastDate)) {
        existing.lastDate = b.date;
      }
      map.set(b.student_id, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.sessions - a.sessions);
  }, [bookings]);

  const NAV = [
    { id: "overview", label: "Overview", icon: GraduationCap },
    { id: "schedule", label: "My Schedule", icon: CalendarDays },
    { id: "students", label: "Students", icon: Users },
    { id: "profile", label: "Profile", icon: UserIcon },
  ] as const;

  const verification = profile?.verification_status ?? "pending";
  const banner =
    verification === "verified"
      ? {
          cls: "bg-success/10 text-success border-success/30",
          icon: ShieldCheck,
          text: "Your account is verified — students can find and book you.",
        }
      : verification === "pending"
        ? {
            cls: "bg-warning/15 text-warning-foreground border-warning/40",
            icon: Clock,
            text: "Verification under review — typically 24-48 hours.",
          }
        : {
            cls: "bg-destructive/10 text-destructive border-destructive/30",
            icon: ShieldAlert,
            text:
              profile?.rejection_reason
                ? `Verification rejected — ${profile.rejection_reason}`
                : "Verification rejected — please re-submit your documents.",
          };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 grid lg:grid-cols-[240px_1fr] gap-8">
      <aside className="space-y-1">
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => setTab(n.id)}
            className={`w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${tab === n.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
          >
            <n.icon className="h-4 w-4" /> {n.label}
          </button>
        ))}
        <Link
          to="/classroom-preview"
          className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
        >
          <Video className="h-4 w-4" /> Test video room
        </Link>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </aside>

      <div className="space-y-6">
        {loadingProfile ? null : (
          <div className={`rounded-md border px-4 py-3 text-sm font-medium inline-flex items-center gap-2 ${banner.cls}`}>
            <banner.icon className="h-4 w-4" /> {banner.text}
          </div>
        )}

        {tab === "overview" && (
          <>
            <h1 className="text-2xl font-bold">Welcome back, {user?.full_name ?? "Teacher"}</h1>
            <div className="grid sm:grid-cols-4 gap-4">
              <Stat icon={Users} label="Total students" value={String(stats.students)} />
              <Stat icon={CalendarDays} label="Sessions this month" value={String(stats.thisMonth)} />
              <Stat
                icon={GraduationCap}
                label="Avg. rating"
                value={profile?.average_rating ? profile.average_rating.toFixed(1) : "—"}
              />
              <Stat icon={DollarSign} label="Earnings" value={`Rs. ${stats.earnings.toLocaleString()}`} />
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="font-semibold mb-4">Today's Sessions</h2>
              {todaysBookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No sessions today.</p>
              ) : (
                <div className="divide-y divide-border">
                  {todaysBookings.map((s) => (
                    <div key={s.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium">{s.student_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.subject} · {fmtTime(s.start_time)} – {fmtTime(s.end_time)}
                        </p>
                      </div>
                      <Link
                        to="/classroom/$sessionId"
                        params={{ sessionId: String(s.session_id ?? s.id) }}
                        className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                      >
                        <Video className="h-3.5 w-3.5" /> Join
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {tab === "schedule" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">My Schedule (next 7 days)</h2>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {weekSchedule.map((day) => (
                <div
                  key={day.date}
                  className="rounded-lg border border-border bg-card p-3 min-h-[140px]"
                >
                  <p className="text-xs font-semibold text-muted-foreground">
                    {day.dayName} {day.dayNum}
                  </p>
                  <div className="mt-2 space-y-1">
                    {day.bookings.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">No sessions</p>
                    )}
                    {day.bookings.map((b) => (
                      <Link
                        key={b.id}
                        to="/classroom/$sessionId"
                        params={{ sessionId: String(b.session_id ?? b.id) }}
                        className="block rounded bg-primary/10 p-2 text-xs hover:bg-primary/20"
                      >
                        <p className="font-semibold text-primary">{fmtTime(b.start_time)}</p>
                        <p className="text-muted-foreground truncate">{b.student_name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{b.subject}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "students" && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-6 border-b border-border">
              <h2 className="font-semibold">My Students</h2>
            </div>
            {studentRollup.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No students yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3">Student</th>
                    <th className="px-6 py-3">Sessions</th>
                    <th className="px-6 py-3">Last session</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {studentRollup.map((s) => (
                    <tr key={s.name + (s.lastDate ?? "")}>
                      <td className="px-6 py-3 font-medium">{s.name}</td>
                      <td className="px-6 py-3">{s.sessions}</td>
                      <td className="px-6 py-3 text-muted-foreground">{s.lastDate ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === "profile" && (
          <ProfileEditor
            profile={profile}
            onSaved={(p) => setProfile(p)}
            error={error}
            setError={setError}
          />
        )}

        {tab === "overview" && bookings.length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-6 border-b border-border">
              <h2 className="font-semibold">Recent bookings</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-6 py-3">Student</th>
                  <th className="px-6 py-3">Subject</th>
                  <th className="px-6 py-3">When</th>
                  <th className="px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bookings.slice(0, 8).map((b) => (
                  <tr key={b.id}>
                    <td className="px-6 py-3 font-medium">{b.student_name}</td>
                    <td className="px-6 py-3 text-muted-foreground">{b.subject}</td>
                    <td className="px-6 py-3 text-muted-foreground">
                      {b.date} · {fmtTime(b.start_time)}
                    </td>
                    <td className="px-6 py-3">
                      <BookingStatusBadge status={b.status ?? "upcoming"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-3 text-xs uppercase text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function ProfileEditor({
  profile,
  onSaved,
  error,
  setError,
}: {
  profile: TeacherProfile | null;
  onSaved: (p: TeacherProfile) => void;
  error: string | null;
  setError: (s: string | null) => void;
}) {
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [hourlyRate, setHourlyRate] = useState(String(profile?.hourly_rate ?? "1000"));
  const [yearsExperience, setYearsExperience] = useState(String(profile?.years_experience ?? "1"));
  const [teachingMode, setTeachingMode] = useState(profile?.teaching_mode ?? "online");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setBio(profile.bio ?? "");
    setHourlyRate(String(profile.hourly_rate ?? "1000"));
    setYearsExperience(String(profile.years_experience ?? "1"));
    setTeachingMode(profile.teaching_mode ?? "online");
  }, [profile]);

  if (!profile) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          We couldn't find your teacher profile yet. If you just registered, apply first via{" "}
          <Link to="/register/teacher" className="text-primary font-medium">
            /register/teacher
          </Link>{" "}
          (your account is already created — only the profile is missing).
        </p>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await api.patch(`teachers/${profile.id}/update/`, {
        bio,
        hourly_rate: hourlyRate,
        years_experience: Number(yearsExperience),
        teaching_mode: teachingMode,
      });
      const updated = normalizeTeacher(unwrap(res)) as any;
      // normalizeTeacher flattens user — but for the dashboard we keep the raw profile shape.
      onSaved({ ...profile, bio, hourly_rate: hourlyRate, years_experience: Number(yearsExperience), teaching_mode: teachingMode, ...updated });
      setSaved(true);
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : detail
            ? JSON.stringify(detail)
            : "Could not save profile.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">Edit Profile</h2>
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5" /> Saved
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Update your bio, subjects, rate, and availability.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Hourly rate (PKR)">
          <input
            type="number"
            min="0"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Years of experience">
          <input
            type="number"
            min="0"
            value={yearsExperience}
            onChange={(e) => setYearsExperience(e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>
      <Field label="Teaching mode">
        <select
          value={teachingMode}
          onChange={(e) => setTeachingMode(e.target.value)}
          className={inputCls}
        >
          <option value="online">Online</option>
          <option value="inperson">In-person</option>
          <option value="both">Both</option>
        </select>
      </Field>
      <Field label="Bio">
        <textarea
          rows={4}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className={inputCls}
        />
      </Field>

      <ErrorMessage message={error} />

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";
