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

function NearbyPage() {
  const [center, setCenter] = useState<[number, number]>([31.5497, 74.3436]);
  const [tutors, setTutors] = useState<NearbyTeacher[]>([]);
  const [mounted, setMounted] = useState(false);
  const [loadingTutors, setLoadingTutors] = useState(true);

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
    setLoadingTutors(true);
    api.get("teachers/nearby/", { params: { lat: center[0], lng: center[1], radius: 25 } })
      .then((res) => {
        const list = normalizeTeachers(unwrapList(res)) as NearbyTeacher[];
        setTutors(list);
      })
      .catch(() => {
        setTutors([]);
      })
      .finally(() => setLoadingTutors(false));
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
        {loadingTutors ? (
          <LoadingSpinner label="Loading nearby tutors..." />
        ) : tutors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No nearby tutors found yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {tutors.map((t) => <TeacherCard key={t.id} teacher={t} />)}
          </div>
        )}
      </div>
      <div className="hidden"><Link to="/teachers/$id" params={{ id: "1" }}>x</Link></div>
    </div>
  );
}
