import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calendar, GraduationCap, History, Search, User, LogOut, Video, Star } from "lucide-react";
import api, { unwrapList } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { BookingStatusBadge } from "@/components/BookingStatusBadge";

export const Route = createFileRoute("/dashboard/student")({
  head: () => ({ meta: [{ title: "Student Dashboard — NoorConnect" }] }),
  component: () => <ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>,
});

interface Booking {
  id: string | number;
  session_id?: number | null;
  teacher_name?: string;
  subject?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  time?: string;
  status?: string;
  reviewed?: boolean;
  meet_link?: string;
}

const SAMPLE_BOOKINGS: Booking[] = [
  { id: 1, teacher_name: "Ustadh Ahmed Khan", subject: "Tajweed", date: "2026-05-14", start_time: "17:00:00", end_time: "18:00:00", status: "upcoming", meet_link: "https://meet.google.com/abc-defg-hij" },
  { id: 2, teacher_name: "Ustadha Aisha Siddiqui", subject: "Nazra", date: "2026-05-10", start_time: "16:00:00", end_time: "17:00:00", status: "completed", reviewed: false },
  { id: 3, teacher_name: "Sheikh Bilal Hassan", subject: "Tajweed", date: "2026-05-02", start_time: "18:00:00", end_time: "19:00:00", status: "completed", reviewed: true },
];

function fmtTime(t?: string) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hh = Number(h);
  const ampm = hh >= 12 ? "PM" : "AM";
  const display = ((hh + 11) % 12) + 1;
  return `${display}:${m} ${ampm}`;
}

function StudentDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<"overview" | "bookings" | "sessions">("overview");
  const [bookings, setBookings] = useState<Booking[]>(SAMPLE_BOOKINGS);

  useEffect(() => {
    api.get("bookings/").then((r) => {
      const list = unwrapList<Booking>(r);
      if (list.length) setBookings(list);
    }).catch(() => {});
    // Mark "reviewed" status by fetching the student's reviews
    api.get("reviews/").then((r) => {
      const reviews = unwrapList<{ booking: number }>(r);
      const reviewedBookings = new Set(reviews.map((rv) => rv.booking));
      setBookings((prev) =>
        prev.map((b) => (reviewedBookings.has(Number(b.id)) ? { ...b, reviewed: true } : b)),
      );
    }).catch(() => {});
  }, []);

  const upcoming = bookings.filter((b) => b.status === "upcoming");
  const completed = bookings.filter((b) => b.status === "completed");

  const NAV = [
    { id: "overview", label: "Overview", icon: GraduationCap },
    { id: "bookings", label: "My Bookings", icon: Calendar },
    { id: "sessions", label: "My Sessions", icon: History },
  ] as const;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 grid lg:grid-cols-[240px_1fr] gap-8">
      <aside className="space-y-1">
        {NAV.map((n) => (
          <button key={n.id} onClick={() => setTab(n.id)}
            className={`w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${tab === n.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
            <n.icon className="h-4 w-4" /> {n.label}
          </button>
        ))}
        <Link to="/teachers" className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent">
          <Search className="h-4 w-4" /> Find a Teacher
        </Link>
        <button onClick={logout} className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10">
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </aside>

      <div>
        {tab === "overview" && (
          <div className="space-y-6">
            <div className="rounded-xl bg-gradient-to-r from-primary to-primary-dark text-primary-foreground p-6">
              <h1 className="text-2xl font-bold">Assalamu alaikum, {user?.full_name ?? "Student"}</h1>
              <p className="text-primary-foreground/80 mt-1">Continue your Quran learning journey.</p>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <Stat label="Total sessions" value={bookings.length} />
              <Stat label="Upcoming sessions" value={upcoming.length} />
              <Stat label="Teachers booked" value={new Set(bookings.map((b) => b.teacher_name)).size} />
            </div>

            {upcoming[0] && (
              <div className="rounded-xl border border-border bg-card p-6">
                <h2 className="font-semibold mb-3">Next session</h2>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                    {upcoming[0].teacher_name?.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{upcoming[0].teacher_name}</p>
                    <p className="text-sm text-muted-foreground">{upcoming[0].subject} · {upcoming[0].date} · {fmtTime(upcoming[0].start_time ?? upcoming[0].time)}</p>
                  </div>
                  {upcoming[0].session_id ? (
                    <Link to="/classroom/$sessionId" params={{ sessionId: String(upcoming[0].session_id) }}
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                      <Video className="h-4 w-4" /> Join Session
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-md bg-muted px-4 py-2 text-sm font-medium text-muted-foreground"
                      title="Session room is still being prepared.">
                      <Video className="h-4 w-4" /> Not ready yet
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "bookings" && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-6 border-b border-border"><h2 className="font-semibold">My Bookings</h2></div>
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-6 py-3">Teacher</th>
                  <th className="px-6 py-3">Subject</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td className="px-6 py-3 font-medium">{b.teacher_name}</td>
                    <td className="px-6 py-3 text-muted-foreground">{b.subject}</td>
                    <td className="px-6 py-3 text-muted-foreground">{b.date} · {fmtTime(b.start_time ?? b.time)}</td>
                    <td className="px-6 py-3"><BookingStatusBadge status={b.status ?? "pending"} /></td>
                    <td className="px-6 py-3 text-right">
                      {b.status === "upcoming" && b.session_id && (
                        <Link to="/classroom/$sessionId" params={{ sessionId: String(b.session_id) }} className="text-primary text-sm font-semibold">Join</Link>
                      )}
                      {b.status === "completed" && !b.reviewed && (
                        <Link to="/review/$bookingId" params={{ bookingId: String(b.id) }} className="text-primary text-sm font-semibold">Review</Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "sessions" && (
          <div className="space-y-3">
            <h2 className="font-semibold text-lg">Past Sessions</h2>
            {completed.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
                <div>
                  <p className="font-semibold">{b.teacher_name} · <span className="text-muted-foreground font-normal">{b.subject}</span></p>
                  <p className="text-xs text-muted-foreground">{b.date} · {fmtTime(b.start_time ?? b.time)}</p>
                </div>
                {!b.reviewed && (
                  <Link to="/review/$bookingId" params={{ bookingId: String(b.id) }}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                    <Star className="h-4 w-4" /> Leave a review
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );
}
