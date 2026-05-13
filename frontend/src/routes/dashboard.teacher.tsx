import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarDays, DollarSign, GraduationCap, LogOut, User as UserIcon, Users, Video } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export const Route = createFileRoute("/dashboard/teacher")({
  head: () => ({ meta: [{ title: "Teacher Dashboard — NoorConnect" }] }),
  component: () => <ProtectedRoute role="teacher"><TeacherDashboard /></ProtectedRoute>,
});

function TeacherDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<"overview" | "schedule" | "students" | "profile">("overview");
  const verification: "pending" | "verified" | "rejected" = "verified";

  const NAV = [
    { id: "overview", label: "Overview", icon: GraduationCap },
    { id: "schedule", label: "My Schedule", icon: CalendarDays },
    { id: "students", label: "Students", icon: Users },
    { id: "profile", label: "Profile", icon: UserIcon },
  ] as const;

  const sessions = [
    { id: 1, student: "Ali H.", subject: "Tajweed", time: "5:00 PM", date: "Today" },
    { id: 2, student: "Sara K.", subject: "Hifz", time: "6:30 PM", date: "Today" },
    { id: 3, student: "Bilal A.", subject: "Nazra", time: "4:00 PM", date: "Tomorrow" },
  ];

  const banner = verification === "verified"
    ? { cls: "bg-success/10 text-success border-success/30", text: "Your account is verified ✓" }
    : verification === "pending"
      ? { cls: "bg-warning/15 text-warning-foreground border-warning/40", text: "Verification under review" }
      : { cls: "bg-destructive/10 text-destructive border-destructive/30", text: "Verification rejected — please re-submit" };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 grid lg:grid-cols-[240px_1fr] gap-8">
      <aside className="space-y-1">
        {NAV.map((n) => (
          <button key={n.id} onClick={() => setTab(n.id)}
            className={`w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${tab === n.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
            <n.icon className="h-4 w-4" /> {n.label}
          </button>
        ))}
        <button onClick={logout} className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10">
          <LogOut className="h-4 w-4" /> Logout
        </button>
      </aside>

      <div className="space-y-6">
        <div className={`rounded-md border px-4 py-3 text-sm font-medium ${banner.cls}`}>{banner.text}</div>

        {tab === "overview" && (
          <>
            <h1 className="text-2xl font-bold">Welcome back, {user?.full_name ?? "Teacher"}</h1>
            <div className="grid sm:grid-cols-4 gap-4">
              <Stat icon={Users} label="Total students" value="24" />
              <Stat icon={CalendarDays} label="Sessions this month" value="48" />
              <Stat icon={GraduationCap} label="Avg. rating" value="4.9" />
              <Stat icon={DollarSign} label="Earnings" value="Rs. 58,000" />
            </div>
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="font-semibold mb-4">Today's Sessions</h2>
              <div className="divide-y divide-border">
                {sessions.filter((s) => s.date === "Today").map((s) => (
                  <div key={s.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">{s.student}</p>
                      <p className="text-xs text-muted-foreground">{s.subject} · {s.time}</p>
                    </div>
                    <Link to="/classroom/$sessionId" params={{ sessionId: String(s.id) }}
                      className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                      <Video className="h-3.5 w-3.5" /> Join
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === "schedule" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">My Schedule</h2>
              <button className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Set Availability</button>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
                <div key={d} className="rounded-lg border border-border bg-card p-3 min-h-[140px]">
                  <p className="text-xs font-semibold text-muted-foreground">{d}</p>
                  {i < 3 && (
                    <div className="mt-2 rounded bg-primary/10 p-2 text-xs">
                      <p className="font-semibold text-primary">5:00 PM</p>
                      <p className="text-muted-foreground">{sessions[i % 3].student}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "students" && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-6 border-b border-border"><h2 className="font-semibold">My Students</h2></div>
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs uppercase text-muted-foreground">
                <tr><th className="px-6 py-3">Student</th><th className="px-6 py-3">Sessions</th><th className="px-6 py-3">Last session</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[{n:"Ali H.",c:12,d:"May 12, 2026"},{n:"Sara K.",c:8,d:"May 10, 2026"},{n:"Bilal A.",c:5,d:"May 8, 2026"}].map((s) => (
                  <tr key={s.n}>
                    <td className="px-6 py-3 font-medium">{s.n}</td>
                    <td className="px-6 py-3">{s.c}</td>
                    <td className="px-6 py-3 text-muted-foreground">{s.d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "profile" && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="font-semibold text-lg">Edit Profile</h2>
            <p className="text-sm text-muted-foreground">Update your bio, subjects, rate, and availability.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="Hourly rate (PKR)" defaultValue="1200" />
              <Input label="Years of experience" defaultValue="12" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Bio</label>
              <textarea rows={4} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" defaultValue="Hafiz with 12 years of teaching experience..." />
            </div>
            <button className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Save changes</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-3 text-xs uppercase text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function Input({ label, defaultValue }: { label: string; defaultValue?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      <input defaultValue={defaultValue} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
    </div>
  );
}
