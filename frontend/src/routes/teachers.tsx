import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import api from "@/lib/api";
import { TeacherCard, type Teacher } from "@/components/TeacherCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ErrorMessage } from "@/components/ErrorMessage";

export const Route = createFileRoute("/teachers")({
  head: () => ({
    meta: [
      { title: "Find a Quran Teacher — NoorConnect" },
      { name: "description", content: "Search verified Quran teachers by subject, gender, city, price, and rating. Online & in-person." },
    ],
  }),
  component: TeacherSearchPage,
});

const SUBJECTS = ["Noorani Qaida", "Nazra", "Tajweed", "Hifz", "Islamic Studies"];
const CITIES = ["All", "Lahore", "Karachi", "Islamabad", "Multan", "Peshawar"];

const SAMPLE: Teacher[] = [
  { id: 1, full_name: "Ustadh Ahmed Khan", subjects: ["Tajweed", "Hifz"], city: "Lahore", mode: "online", hourly_rate: 1200, rating: 4.9, reviews_count: 128, verified: true },
  { id: 2, full_name: "Ustadha Aisha Siddiqui", subjects: ["Noorani Qaida", "Nazra"], city: "Karachi", mode: "both", hourly_rate: 900, rating: 4.8, reviews_count: 92, verified: true },
  { id: 3, full_name: "Sheikh Bilal Hassan", subjects: ["Tajweed", "Islamic Studies"], city: "Islamabad", mode: "online", hourly_rate: 1500, rating: 5.0, reviews_count: 64, verified: true },
  { id: 4, full_name: "Ustadha Maryam Noor", subjects: ["Hifz", "Tajweed"], city: "Multan", mode: "both", hourly_rate: 1100, rating: 4.7, reviews_count: 45, verified: true },
  { id: 5, full_name: "Ustadh Yusuf Iqbal", subjects: ["Noorani Qaida"], city: "Lahore", mode: "in-person", hourly_rate: 800, rating: 4.6, reviews_count: 38, verified: true },
  { id: 6, full_name: "Ustadha Khadija Rehman", subjects: ["Nazra", "Islamic Studies"], city: "Karachi", mode: "online", hourly_rate: 1000, rating: 4.9, reviews_count: 71, verified: true },
];

function TeacherSearchPage() {
  const [teachers, setTeachers] = useState<Teacher[]>(SAMPLE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [search, setSearch] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [gender, setGender] = useState("any");
  const [mode, setMode] = useState("any");
  const [city, setCity] = useState("All");
  const [maxPrice, setMaxPrice] = useState(15000);
  const [minRating, setMinRating] = useState(0);
  const [ordering, setOrdering] = useState("-rating");
  const [showFilters, setShowFilters] = useState(false);

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (search) p.search = search;
    if (subjects.length) p.subject = subjects.join(",");
    if (gender !== "any") p.gender = gender;
    if (mode !== "any") p.mode = mode;
    if (city !== "All") p.city = city;
    p.max_price = String(maxPrice);
    if (minRating) p.rating = String(minRating);
    p.ordering = ordering;
    return p;
  }, [search, subjects, gender, mode, city, maxPrice, minRating, ordering]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get("teachers/", { params })
      .then((res) => {
        const list = res.data?.data ?? res.data?.results ?? res.data;
        setTeachers(Array.isArray(list) && list.length ? list : SAMPLE);
      })
      .catch(() => {
        setTeachers(SAMPLE);
      })
      .finally(() => setLoading(false));
  }, [params]);

  const toggleSubject = (s: string) =>
    setSubjects((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const FilterPanel = (
    <aside className="space-y-6">
      <div>
        <h3 className="font-semibold mb-3">Subject</h3>
        <div className="space-y-2">
          {SUBJECTS.map((s) => (
            <label key={s} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={subjects.includes(s)}
                onChange={() => toggleSubject(s)}
                className="rounded border-input text-primary focus:ring-primary"
              />
              {s}
            </label>
          ))}
        </div>
      </div>
      <div>
        <h3 className="font-semibold mb-3">Gender</h3>
        <div className="space-y-1.5">
          {["any", "male", "female"].map((g) => (
            <label key={g} className="flex items-center gap-2 text-sm capitalize">
              <input type="radio" checked={gender === g} onChange={() => setGender(g)} className="text-primary" />
              {g}
            </label>
          ))}
        </div>
      </div>
      <div>
        <h3 className="font-semibold mb-3">Teaching mode</h3>
        <div className="space-y-1.5">
          {[["any","Any"],["online","Online"],["in-person","In-person"],["both","Both"]].map(([v,l]) => (
            <label key={v} className="flex items-center gap-2 text-sm">
              <input type="radio" checked={mode === v} onChange={() => setMode(v)} className="text-primary" />
              {l}
            </label>
          ))}
        </div>
      </div>
      <div>
        <h3 className="font-semibold mb-3">City</h3>
        <select value={city} onChange={(e) => setCity(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
          {CITIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <h3 className="font-semibold mb-3">Max price: <span className="text-primary">Rs. {maxPrice.toLocaleString()}</span></h3>
        <input type="range" min={0} max={15000} step={500} value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} className="w-full accent-primary" />
      </div>
      <div>
        <h3 className="font-semibold mb-3">Minimum rating</h3>
        <div className="flex gap-2 flex-wrap">
          {[0, 3, 4, 4.5].map((r) => (
            <button
              key={r}
              onClick={() => setMinRating(r)}
              className={`px-3 py-1 rounded-full text-xs border ${minRating === r ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"}`}
            >
              {r === 0 ? "Any" : `${r}+`}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Find a Teacher</h1>
        <p className="text-muted-foreground mt-1">Browse {teachers.length} verified Quran teachers.</p>
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-8">
        <div className="hidden lg:block">{FilterPanel}</div>

        <div>
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or subject..."
                className="w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <select value={ordering} onChange={(e) => setOrdering(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="-rating">Highest rated</option>
              <option value="hourly_rate">Lowest price</option>
              <option value="-reviews_count">Most reviews</option>
            </select>
            <button onClick={() => setShowFilters(true)} className="lg:hidden inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm">
              <SlidersHorizontal className="h-4 w-4" /> Filters
            </button>
          </div>

          <ErrorMessage message={error} />
          {loading ? (
            <LoadingSpinner />
          ) : teachers.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground">No teachers match your filters.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-5">
              {teachers.map((t) => <TeacherCard key={t.id} teacher={t} />)}
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      {showFilters && (
        <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur p-6 overflow-y-auto lg:hidden">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Filters</h2>
            <button onClick={() => setShowFilters(false)}><X className="h-5 w-5" /></button>
          </div>
          {FilterPanel}
          <button onClick={() => setShowFilters(false)} className="mt-6 w-full rounded-md bg-primary py-3 text-primary-foreground font-semibold">
            Apply Filters
          </button>
        </div>
      )}
    </div>
  );
}
