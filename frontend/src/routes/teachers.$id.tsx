import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calendar, Globe2, GraduationCap, MapPin, Monitor, Share2, Users } from "lucide-react";
import api, { normalizeTeacher, unwrap, unwrapList } from "@/lib/api";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { StarRating } from "@/components/StarRating";
import { VerifiedBadge } from "@/components/VerifiedBadge";

export const Route = createFileRoute("/teachers/$id")({
  head: () => ({
    meta: [
      { title: "Teacher Profile — NoorConnect" },
      { name: "description", content: "View teacher bio, subjects, rates, reviews, and book a free trial." },
    ],
  }),
  component: TeacherProfilePage,
});

interface Teacher {
  id: string | number;
  full_name?: string;
  bio?: string;
  avatar?: string;
  cover?: string;
  subjects?: string[];
  levels?: string[];
  languages?: string[];
  mode?: string;
  experience?: number;
  city?: string;
  hourly_rate?: number;
  rating?: number;
  reviews_count?: number;
  verified?: boolean;
}

interface Review {
  id: string | number;
  student_name?: string;
  rating: number;
  comment: string;
  created_at?: string;
}

const FALLBACK: Teacher = {
  id: "1",
  full_name: "Ustadh Ahmed Khan",
  bio: "Hafiz-ul-Quran with 12 years of teaching experience. Specializes in Tajweed and Hifz for children and adults. Patient, structured, and warm.",
  subjects: ["Tajweed", "Hifz", "Nazra"],
  levels: ["Noorani Qaida", "Nazra", "Tajweed", "Hifz"],
  languages: ["Urdu", "English", "Arabic"],
  mode: "both",
  experience: 12,
  city: "Lahore",
  hourly_rate: 1200,
  rating: 4.9,
  reviews_count: 128,
  verified: true,
};

const FALLBACK_REVIEWS: Review[] = [
  { id: 1, student_name: "Fatima R.", rating: 5, comment: "Excellent teacher. My son made huge progress in 2 months." },
  { id: 2, student_name: "Hamza A.", rating: 5, comment: "Very patient and thorough with Tajweed rules." },
  { id: 3, student_name: "Sara M.", rating: 4, comment: "Great teacher, sessions are well-paced." },
];

function TeacherProfilePage() {
  const { id } = Route.useParams();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.get(`teachers/${id}/`).then((r) => normalizeTeacher(unwrap(r))),
      api.get(`reviews/`, { params: { teacher: id } }).then((r) => unwrapList<Review>(r)),
    ]).then(([t, r]) => {
      const teacherData = t.status === "fulfilled" && t.value ? (t.value as any) : FALLBACK;
      const teacherWithReviews =
        teacherData && t.status === "fulfilled" && (t.value as any)?.reviews?.length
          ? { ...teacherData, reviews: undefined }
          : teacherData;
      setTeacher(teacherWithReviews);
      const fetchedReviews =
        t.status === "fulfilled" && (t.value as any)?.reviews?.length
          ? ((t.value as any).reviews as Review[])
          : r.status === "fulfilled" && r.value.length
            ? r.value
            : FALLBACK_REVIEWS;
      setReviews(fetchedReviews);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <LoadingSpinner label="Loading teacher..." />;
  if (!teacher) return <div className="p-12 text-center">Teacher not found.</div>;

  const modeLabel =
    teacher.mode === "both" ? "Online & In-person" : teacher.mode === "in-person" ? "In-person" : "Online";

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid lg:grid-cols-[1fr_360px] gap-8">
        <div>
          {/* Cover + photo */}
          <div className="rounded-xl overflow-hidden border border-border">
            <div className="h-40 bg-gradient-to-r from-primary to-primary-dark" />
            <div className="bg-card px-6 pb-6">
              <div className="flex items-end gap-4 -mt-12">
                <div className="h-24 w-24 rounded-full ring-4 ring-card bg-secondary text-primary flex items-center justify-center text-3xl font-bold">
                  {teacher.full_name?.charAt(0)}
                </div>
                <div className="pb-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-bold">{teacher.full_name}</h1>
                    {teacher.verified && <VerifiedBadge />}
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                    {teacher.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{teacher.city}</span>}
                    <span className="inline-flex items-center gap-1"><Monitor className="h-3.5 w-3.5" />{modeLabel}</span>
                    <span className="inline-flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" />{teacher.experience} yrs experience</span>
                  </div>
                  {teacher.rating !== undefined && (
                    <div className="mt-2"><StarRating value={teacher.rating} count={teacher.reviews_count} /></div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* About */}
          <section className="mt-6 rounded-xl border border-border bg-card p-6">
            <h2 className="font-semibold text-lg mb-2">About</h2>
            <p className="text-foreground/80">{teacher.bio}</p>
          </section>

          {/* Subjects/levels/languages */}
          <section className="mt-6 grid sm:grid-cols-3 gap-4">
            <Block title="Subjects" items={teacher.subjects ?? []} />
            <Block title="Levels" items={teacher.levels ?? []} />
            <Block title="Languages" items={teacher.languages ?? []} icon={<Globe2 className="h-4 w-4" />} />
          </section>

          {/* Reviews */}
          <section className="mt-6 rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Reviews</h2>
              <StarRating value={teacher.rating ?? 0} count={teacher.reviews_count} />
            </div>
            <div className="space-y-4 divide-y divide-border">
              {reviews.map((r) => (
                <div key={r.id} className="pt-4 first:pt-0">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
                      {r.student_name?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{r.student_name}</p>
                      <StarRating value={r.rating} size={12} />
                    </div>
                  </div>
                  <p className="text-sm text-foreground/80">{r.comment}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Sticky booking */}
        <aside className="lg:sticky lg:top-20 self-start rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-3xl font-bold text-foreground">
            Rs. {teacher.hourly_rate?.toLocaleString()}
            <span className="text-base font-normal text-muted-foreground">/hr</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" /> Next available: Tomorrow, 5:00 PM
          </p>
          <Link
            to="/book/$teacherId"
            params={{ teacherId: String(teacher.id) }}
            className="mt-5 block w-full rounded-md bg-primary py-3 text-center font-semibold text-primary-foreground hover:bg-primary-dark transition"
          >
            Book a Free Trial
          </Link>
          <Link
            to="/book/$teacherId"
            params={{ teacherId: String(teacher.id) }}
            className="mt-2 block w-full rounded-md border border-input py-3 text-center font-semibold text-foreground hover:bg-accent transition"
          >
            Book a Session
          </Link>
          <button
            onClick={() => navigator.share?.({ title: teacher.full_name, url: window.location.href }).catch(() => {})}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary"
          >
            <Share2 className="h-4 w-4" /> Share profile
          </button>
        </aside>
      </div>
    </div>
  );
}

function Block({ title, items, icon }: { title: string; items: string[]; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-semibold mb-3 inline-flex items-center gap-2">{icon}{title}</h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <span key={i} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">{i}</span>
        ))}
      </div>
    </div>
  );
}
