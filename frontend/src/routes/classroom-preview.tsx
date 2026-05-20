import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Info } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { VideoRoom, type AgoraJoinPayload } from "@/components/VideoRoom";

export const Route = createFileRoute("/classroom-preview")({
  head: () => ({ meta: [{ title: "Video preview — NoorConnect" }] }),
  component: () => (
    <ProtectedRoute>
      <ClassroomPreview />
    </ProtectedRoute>
  ),
});

function ClassroomPreview() {
  const navigate = useNavigate();
  const [payload, setPayload] = useState<AgoraJoinPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get("sessions/preview-token/")
      .then((r) => {
        if (cancelled) return;
        const p = unwrap<AgoraJoinPayload>(r);
        setPayload(p);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.response?.data?.detail ?? "Could not load preview token.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const goBack = () => navigate({ to: "/dashboard/student" });

  if (loading) return <LoadingSpinner label="Preparing test room..." />;

  return (
    <div className="flex h-screen flex-col bg-zinc-950">
      <div className="border-b border-white/10 bg-zinc-900/80 backdrop-blur px-4 py-3 flex items-center gap-4 text-white">
        <button
          onClick={goBack}
          className="text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold">Test classroom</p>
          <p className="text-xs text-zinc-500">
            Verify your camera and microphone before a real session.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-300 px-3 py-1 text-xs">
          <Info className="h-3.5 w-3.5" />
          Preview mode
        </div>
      </div>

      {error && (
        <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}{" "}
          <Link to="/dashboard/student" className="underline">
            Back to dashboard
          </Link>
        </div>
      )}

      <div className="flex-1 min-h-0">
        <VideoRoom
          joinPayload={payload}
          selfLabel={payload?.display_name ?? "You"}
          remoteLabel="Test room"
          onLeave={goBack}
        />
      </div>
    </div>
  );
}
