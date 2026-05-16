import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import api from "@/lib/api";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { StarRating } from "@/components/StarRating";
import { ErrorMessage } from "@/components/ErrorMessage";

export const Route = createFileRoute("/review/$bookingId")({
  head: () => ({ meta: [{ title: "Leave a Review — NoorConnect" }] }),
  component: () => <ProtectedRoute role="student"><ReviewPage /></ProtectedRoute>,
});

function ReviewPage() {
  const { bookingId } = Route.useParams();
  const navigate = useNavigate();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSubmitting(true); setError(null);
    try {
      await api.post("reviews/", { booking_id: Number(bookingId), rating, comment });
      navigate({ to: "/dashboard/student" });
    } catch (e: any) {
      setError(e.response?.data?.detail ?? "Failed to submit review.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="rounded-xl border border-border bg-card p-8">
        <h1 className="text-2xl font-bold">Leave a review</h1>
        <p className="text-sm text-muted-foreground mt-1">Help other students by sharing your experience.</p>

        <div className="mt-6 flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">U</div>
          <div>
            <p className="font-semibold">Ustadh Ahmed Khan</p>
            <p className="text-xs text-muted-foreground">Booking #{bookingId}</p>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-medium mb-2">Your rating</p>
          <StarRating value={rating} interactive onChange={setRating} size={32} />
        </div>

        <div className="mt-6">
          <label className="text-sm font-medium mb-2 block">Your review</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={5}
            placeholder="Share what you liked, what helped you learn..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <ErrorMessage message={error} />

        <button disabled={submitting || !comment.trim()} onClick={submit}
          className="mt-6 w-full rounded-md bg-primary py-3 font-semibold text-primary-foreground hover:bg-primary-dark disabled:opacity-50">
          {submitting ? "Submitting..." : "Submit Review"}
        </button>
      </div>
    </div>
  );
}
