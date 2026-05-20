import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Clock,
  FileText,
  MessageSquare,
  Save,
  X,
} from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ErrorMessage } from "@/components/ErrorMessage";
import { VideoRoom, type AgoraJoinPayload } from "@/components/VideoRoom";

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
  booking_id?: number;
  teacher_name?: string;
  teacher_id?: number;
  student_name?: string;
  student_id?: number;
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
  const [joinPayload, setJoinPayload] = useState<AgoraJoinPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebar, setSidebar] = useState(true);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(60 * 60);
  const hasStartedRef = useRef(false);
  const [selfLabel, setSelfLabel] = useState<string>("You");

  // ---- Load session + Agora token ----
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const sessionRes = await api.get(`sessions/${sessionId}/`);
        if (cancelled) return;
        const s = unwrap<Session>(sessionRes);
        if (!s) {
          setError("Session not found.");
          return;
        }
        setSession(s);
        setNotes(s.student_notes ?? "");
        setSeconds(minutesBetween(s.start_time, s.end_time) * 60);

        // Auto-start booking if still upcoming
        if (!hasStartedRef.current && s.status === "upcoming") {
          hasStartedRef.current = true;
          try {
            const started = await api.patch(`sessions/${sessionId}/start/`);
            if (!cancelled) {
              const updated = unwrap<Session>(started) ?? s;
              setSession(updated);
            }
          } catch {
            // ignore — backend may reject (e.g., cancelled/completed)
          }
        }

        // Fetch Agora join credentials
        const tokenRes = await api.get(`sessions/${sessionId}/agora-token/`);
        if (cancelled) return;
        const payload = unwrap<AgoraJoinPayload>(tokenRes);
        if (payload) {
          setJoinPayload(payload);
          if (payload.display_name) setSelfLabel(payload.display_name);
        }
      } catch (e: any) {
        if (cancelled) return;
        const detail = e.response?.data?.detail;
        setError(
          typeof detail === "string"
            ? detail
            : "Could not load the classroom. Try refreshing the page.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

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
    try {
      // Notes are persisted by the end-session endpoint, so we just buffer them
      // locally with a brief "saved" affordance.
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
  if (!session)
    return (
      <div className="p-12 text-center">
        <p>{error ?? "Session not found."}</p>
        <Link to="/dashboard/student" className="text-primary underline mt-3 inline-block">
          Back to dashboard
        </Link>
      </div>
    );

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  // The "remote" label: if the user is a student, show the teacher's name and vice versa.
  // We don't know the viewer's role here, so we infer from the join payload.
  const viewerIsTeacher = joinPayload?.role_in_session === "teacher";
  const remoteLabel = viewerIsTeacher ? session.student_name : session.teacher_name;

  return (
    <div className="flex h-screen flex-col bg-zinc-950">
      {/* Header */}
      <div className="border-b border-white/10 bg-zinc-900/80 backdrop-blur px-4 py-3 flex items-center gap-4 text-white">
        <Link
          to="/dashboard/student"
          className="text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">
            {remoteLabel ?? session.teacher_name}
            {session.subject && (
              <span className="ml-2 text-zinc-400 font-normal">· {session.subject}</span>
            )}
          </p>
          <p className="text-xs text-zinc-500">
            {session.date} · {session.start_time?.slice(0, 5)} – {session.end_time?.slice(0, 5)}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 text-sm text-zinc-300 tabular-nums">
          <Clock className="h-4 w-4 text-zinc-400" /> {mm}:{ss}
        </div>
        <button
          onClick={() => setSidebar((s) => !s)}
          className="text-sm text-emerald-400 hover:text-emerald-300 font-medium"
        >
          {sidebar ? "Hide notes" : "Show notes"}
        </button>
        <button
          disabled={
            ending || session.status === "completed" || session.status === "cancelled"
          }
          onClick={endSession}
          className="inline-flex items-center gap-2 rounded-md bg-red-500 hover:bg-red-400 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {ending ? "Ending..." : "End session"}
        </button>
      </div>

      {error && (
        <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2">
          <ErrorMessage message={error} />
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 min-w-0 bg-black">
          <VideoRoom
            joinPayload={joinPayload}
            selfLabel={selfLabel}
            remoteLabel={remoteLabel}
            onLeave={endSession}
          />
        </div>
        {sidebar && (
          <aside className="w-80 border-l border-white/10 bg-zinc-900 flex flex-col text-zinc-100">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-semibold inline-flex items-center gap-2 text-sm">
                <MessageSquare className="h-4 w-4 text-emerald-400" /> Session notes
              </h3>
              <button
                onClick={() => setSidebar(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Take notes during your session..."
              className="flex-1 resize-none bg-transparent p-4 text-sm focus:outline-none placeholder:text-zinc-500"
            />
            <div className="border-t border-white/10 p-3">
              <button
                onClick={saveNotes}
                disabled={savingNotes}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-white/15 px-3 py-1.5 text-xs font-medium hover:bg-white/5 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {savingNotes ? "Saving..." : "Save draft"}
              </button>
              <p className="mt-2 text-[11px] text-zinc-500 text-center">
                Notes are sent to the server when you end the session.
              </p>
            </div>
            <div className="border-t border-white/10 p-4">
              <h4 className="text-sm font-semibold mb-2 inline-flex items-center gap-2">
                <FileText className="h-4 w-4 text-zinc-400" /> Files shared
              </h4>
              <p className="text-xs text-zinc-500">No files shared yet.</p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
