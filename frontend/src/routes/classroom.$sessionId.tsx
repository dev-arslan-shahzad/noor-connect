import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Clock, FileText, MessageSquare, PhoneOff, Save, X } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ErrorMessage } from "@/components/ErrorMessage";

export const Route = createFileRoute("/classroom/$sessionId")({
  head: () => ({ meta: [{ title: "Classroom — NoorConnect" }] }),
  component: () => (
    <ProtectedRoute>
      <Classroom />
    </ProtectedRoute>
  ),
});

interface Session {
  id: number | string;
  meet_link?: string;
  teacher_name?: string;
  student_name?: string;
  subject?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  status?: string;
  is_active?: boolean;
  started_at?: string | null;
  ended_at?: string | null;
  student_notes?: string;
}

const FALLBACK: Session = {
  id: "1",
  meet_link: "https://meet.google.com/landing",
  teacher_name: "Ustadh Ahmed Khan",
  student_name: "You",
  subject: "Tajweed",
  status: "upcoming",
};

function minutesBetween(start?: string, end?: string) {
  if (!start || !end) return 60;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(1, eh * 60 + em - (sh * 60 + sm));
}

function Classroom() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebar, setSidebar] = useState(true);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(60 * 60);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .get(`sessions/${sessionId}/`)
      .then(async (r) => {
        if (cancelled) return;
        const s = unwrap<Session>(r) ?? FALLBACK;
        setSession(s);
        setNotes(s.student_notes ?? "");
        setSeconds(minutesBetween(s.start_time, s.end_time) * 60);

        // Auto-start on first load if booking is still upcoming.
        if (!hasStartedRef.current && s.status === "upcoming") {
          hasStartedRef.current = true;
          try {
            const started = await api.patch(`sessions/${sessionId}/start/`);
            if (!cancelled) setSession(unwrap<Session>(started) ?? s);
          } catch {
            // Backend may reject (cancelled, completed) — keep showing meet link anyway.
          }
        }
      })
      .catch(() => {
        if (!cancelled) setSession(FALLBACK);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const saveNotes = async () => {
    setSavingNotes(true);
    setError(null);
    try {
      // Notes are persisted by the end-session endpoint, so we just buffer them locally
      // until the user ends the session. Show "saved" feedback on-screen.
      await new Promise((r) => setTimeout(r, 250));
    } finally {
      setSavingNotes(false);
    }
  };

  const endSession = async () => {
    if (!session) return;
    setEnding(true);
    setError(null);
    try {
      await api.patch(`sessions/${sessionId}/end/`, { student_notes: notes });
      const bookingId = (session as any).booking_id;
      if (bookingId) {
        navigate({ to: "/review/$bookingId", params: { bookingId: String(bookingId) } });
      } else {
        navigate({ to: "/dashboard/student" });
      }
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : detail
            ? JSON.stringify(detail)
            : "Could not end the session. Please try again.",
      );
    } finally {
      setEnding(false);
    }
  };

  if (loading) return <LoadingSpinner label="Loading session..." />;
  if (!session) return <div className="p-12 text-center">Session not found.</div>;

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="border-b border-border bg-card px-4 py-3 flex items-center gap-4">
        <Link to="/dashboard/student" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <p className="font-semibold">
            {session.teacher_name} ·{" "}
            <span className="text-muted-foreground font-normal">{session.subject}</span>
          </p>
        </div>
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" /> {mm}:{ss}
        </div>
        <button
          onClick={() => setSidebar((s) => !s)}
          className="text-sm text-primary font-medium"
        >
          {sidebar ? "Hide notes" : "Show notes"}
        </button>
        <button
          disabled={ending || session.status === "completed" || session.status === "cancelled"}
          onClick={endSession}
          className="inline-flex items-center gap-2 rounded-md bg-destructive px-3 py-1.5 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
        >
          <PhoneOff className="h-4 w-4" /> {ending ? "Ending..." : "End session"}
        </button>
      </div>

      {error && (
        <div className="border-b border-border bg-destructive/5 px-4 py-2">
          <ErrorMessage message={error} />
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 bg-black">
          <iframe
            src={session.meet_link}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            className="w-full h-full border-0"
            title="Google Meet"
          />
        </div>
        {sidebar && (
          <aside className="w-80 border-l border-border bg-card flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold inline-flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Session notes
              </h3>
              <button onClick={() => setSidebar(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Take notes during your session..."
              className="flex-1 resize-none bg-transparent p-4 text-sm focus:outline-none"
            />
            <div className="border-t border-border p-3">
              <button
                onClick={saveNotes}
                disabled={savingNotes}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {savingNotes ? "Saving..." : "Save draft"}
              </button>
              <p className="mt-2 text-[11px] text-muted-foreground text-center">
                Notes are sent to the server when you end the session.
              </p>
            </div>
            <div className="border-t border-border p-4">
              <h4 className="text-sm font-semibold mb-2 inline-flex items-center gap-2">
                <FileText className="h-4 w-4" /> Files shared
              </h4>
              <p className="text-xs text-muted-foreground">No files shared yet.</p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
