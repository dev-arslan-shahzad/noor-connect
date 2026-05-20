import { Link } from "@tanstack/react-router";
import { MapPin, Monitor, Users } from "lucide-react";
import { StarRating } from "./StarRating";
import { VerifiedBadge } from "./VerifiedBadge";
import { useAuth } from "@/context/AuthContext";

export interface Teacher {
  id: string | number;
  full_name?: string;
  name?: string;
  avatar?: string;
  photo?: string;
  subjects?: string[];
  city?: string;
  mode?: "online" | "in-person" | "both" | string;
  hourly_rate?: number;
  rating?: number;
  reviews_count?: number;
  verified?: boolean;
}

export function TeacherCard({ teacher }: { teacher: Teacher }) {
  const { user } = useAuth();
  const name = teacher.full_name ?? teacher.name ?? "Teacher";
  const photo = teacher.avatar ?? teacher.photo;
  const subjects = teacher.subjects ?? [];
  const mode = teacher.mode ?? "online";
  const modeLabel =
    mode === "both" ? "Online & In-person" : mode === "in-person" ? "In-person" : "Online";
  const ModeIcon = mode === "in-person" ? Users : Monitor;
  const canBook = user?.role === "student";

  return (
    <article className="group flex flex-col rounded-xl border border-border bg-card p-5 transition hover:shadow-md hover:border-primary/30">
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-secondary">
          {photo ? (
            <img src={photo} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-primary">
              {name.charAt(0)}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-foreground truncate">{name}</h3>
            {teacher.verified && <VerifiedBadge />}
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            {teacher.city && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {teacher.city}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <ModeIcon className="h-3 w-3" /> {modeLabel}
            </span>
          </div>
          {teacher.rating !== undefined && (
            <div className="mt-2">
              <StarRating value={teacher.rating} count={teacher.reviews_count} />
            </div>
          )}
        </div>
      </div>

      {subjects.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {subjects.slice(0, 4).map((s) => (
            <span
              key={s}
              className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <div>
          <span className="text-xs text-muted-foreground">From</span>
          <p className="text-sm font-semibold text-foreground">
            Rs. {teacher.hourly_rate?.toLocaleString() ?? "—"}
            <span className="text-xs text-muted-foreground font-normal">/hr</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/teachers/$id"
            params={{ id: String(teacher.id) }}
            className="inline-flex items-center justify-center rounded-md border border-input px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            View Profile
          </Link>
          {canBook && (
            <Link
              to="/book/$teacherId"
              params={{ teacherId: String(teacher.id) }}
              className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:bg-primary-dark"
            >
              Book Now
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
