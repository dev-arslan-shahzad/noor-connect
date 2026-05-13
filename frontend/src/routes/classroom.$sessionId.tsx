import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Clock, FileText, MessageSquare, X } from "lucide-react";
import api from "@/lib/api";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export const Route = createFileRoute("/classroom/$sessionId")({
  head: () => ({ meta: [{ title: "Classroom — NoorConnect" }] }),
  component: () => <ProtectedRoute><Classroom /></ProtectedRoute>,
});

interface Session {
  id: string | number;
  meet_link?: string;
  teacher_name?: string;
  student_name?: string;
  subject?: string;
  duration_minutes?: number;
  starts_at?: string;
}

const FALLBACK: Session = {
  id: "1",
  meet_link: "https://meet.google.com/landing",
  teacher_name: "Ustadh Ahmed Khan",
  student_name: "You",
  subject: "Tajweed",
  duration_minutes: 60,
};

function Classroom() {
  const { sessionId } = Route.useParams();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebar, setSidebar] = useState(true);
  const [notes, setNotes] = useState("");
  const [seconds, setSeconds] = useState(60 * 60);

  useEffect(() => {
    api.get(`sessions/${sessionId}/`)
      .then((r) => setSession(r.data?.data ?? r.data ?? FALLBACK))
      .catch(() => setSession(FALLBACK))
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <LoadingSpinner label="Loading session..." />;
  if (!session) return <div className="p-12 text-center">Session not found.</div>;

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="border-b border-border bg-card px-4 py-3 flex items-center gap-4">
        <Link to="/dashboard/student" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="flex-1">
          <p className="font-semibold">{session.teacher_name} · <span className="text-muted-foreground font-normal">{session.subject}</span></p>
        </div>
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" /> {mm}:{ss}
        </div>
        <button onClick={() => setSidebar((s) => !s)} className="text-sm text-primary font-medium">
          {sidebar ? "Hide notes" : "Show notes"}
        </button>
      </div>

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
              <h3 className="font-semibold inline-flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Session notes</h3>
              <button onClick={() => setSidebar(false)}><X className="h-4 w-4" /></button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Take notes during your session..."
              className="flex-1 resize-none bg-transparent p-4 text-sm focus:outline-none"
            />
            <div className="border-t border-border p-4">
              <h4 className="text-sm font-semibold mb-2 inline-flex items-center gap-2"><FileText className="h-4 w-4" /> Files shared</h4>
              <p className="text-xs text-muted-foreground">No files shared yet.</p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
