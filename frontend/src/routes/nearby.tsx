import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import api, { normalizeTeachers, unwrapList } from "@/lib/api";
import { TeacherCard, type Teacher } from "@/components/TeacherCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export const Route = createFileRoute("/nearby")({
  head: () => ({
    meta: [
      { title: "Nearby Tutors — NoorConnect" },
      { name: "description", content: "Find verified Quran tutors near your location on the map." },
    ],
  }),
  component: NearbyPage,
});

const NearbyMap = lazy(() => import("@/components/NearbyMap"));

interface NearbyTeacher extends Teacher { lat: number; lng: number; }

const SAMPLE: NearbyTeacher[] = [
  { id: 1, full_name: "Ustadh Ahmed Khan", subjects: ["Tajweed", "Hifz"], city: "Lahore", mode: "both", hourly_rate: 1200, rating: 4.9, reviews_count: 128, verified: true, lat: 31.5497, lng: 74.3436 },
  { id: 2, full_name: "Ustadha Aisha Siddiqui", subjects: ["Nazra"], city: "Lahore", mode: "in-person", hourly_rate: 900, rating: 4.8, reviews_count: 92, verified: true, lat: 31.5204, lng: 74.3587 },
  { id: 3, full_name: "Sheikh Bilal Hassan", subjects: ["Tajweed"], city: "Lahore", mode: "online", hourly_rate: 1500, rating: 5, reviews_count: 64, verified: true, lat: 31.5800, lng: 74.3200 },
];

function NearbyPage() {
  const [center, setCenter] = useState<[number, number]>([31.5497, 74.3436]);
  const [tutors, setTutors] = useState<NearbyTeacher[]>(SAMPLE);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCenter([pos.coords.latitude, pos.coords.longitude]),
        () => {},
      );
    }
  }, []);

  useEffect(() => {
    api.get("teachers/nearby/", { params: { lat: center[0], lng: center[1], radius: 25 } })
      .then((res) => {
        const list = normalizeTeachers(unwrapList(res)) as NearbyTeacher[];
        if (list.length) setTutors(list);
      })
      .catch(() => {});
  }, [center]);

  return (
    <div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 pb-4">
        <h1 className="text-3xl font-bold">Nearby Tutors</h1>
        <p className="text-muted-foreground mt-1">Verified Quran teachers near your location.</p>
      </div>

      <div className="h-[55vh] w-full bg-secondary">
        {mounted ? (
          <Suspense fallback={<LoadingSpinner label="Loading map..." />}>
            <NearbyMap center={center} tutors={tutors} />
          </Suspense>
        ) : (
          <LoadingSpinner label="Loading map..." />
        )}
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <h2 className="text-xl font-semibold mb-5">Tutors near you</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {tutors.map((t) => <TeacherCard key={t.id} teacher={t} />)}
        </div>
      </div>
      <div className="hidden"><Link to="/teachers/$id" params={{ id: "1" }}>x</Link></div>
    </div>
  );
}
