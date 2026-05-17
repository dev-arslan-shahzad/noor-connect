import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search, Calendar, Video, ShieldCheck, Users, Globe2, ArrowRight, Quote } from "lucide-react";
import api, { normalizeTeachers, unwrapList } from "@/lib/api";
import { TeacherCard, type Teacher } from "@/components/TeacherCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NoorConnect — Learn Quran with Verified Teachers" },
      { name: "description", content: "Find verified Quran teachers online or near you. Book trial sessions, learn Tajweed, Hifz, Nazra, and more with NoorConnect." },
      { property: "og:title", content: "NoorConnect — Learn Quran with Verified Teachers" },
      { property: "og:description", content: "Find verified Quran teachers online or near you. Book trial sessions and learn at your own pace." },
    ],
  }),
  component: HomePage,
});

const SAMPLE_TEACHERS: Teacher[] = [
  { id: 1, full_name: "Ustadh Ahmed Khan", subjects: ["Tajweed", "Hifz"], city: "Lahore", mode: "online", hourly_rate: 1200, rating: 4.9, reviews_count: 128, verified: true },
  { id: 2, full_name: "Ustadha Aisha Siddiqui", subjects: ["Noorani Qaida", "Nazra"], city: "Karachi", mode: "both", hourly_rate: 900, rating: 4.8, reviews_count: 92, verified: true },
  { id: 3, full_name: "Sheikh Bilal Hassan", subjects: ["Tajweed", "Islamic Studies"], city: "Islamabad", mode: "online", hourly_rate: 1500, rating: 5.0, reviews_count: 64, verified: true },
  { id: 4, full_name: "Ustadha Maryam Noor", subjects: ["Hifz", "Tajweed"], city: "Multan", mode: "both", hourly_rate: 1100, rating: 4.7, reviews_count: 45, verified: true },
];

function HomePage() {
  const [featured, setFeatured] = useState<Teacher[]>(SAMPLE_TEACHERS);

  useEffect(() => {
    // Try featured first; fall back to highest-rated verified teachers so the
    // section is never empty in dev.
    api
      .get("teachers/", { params: { featured: "true", ordering: "highest_rated" } })
      .then((res) => {
        const list = normalizeTeachers(unwrapList(res));
        if (list.length) {
          setFeatured(list.slice(0, 4));
          return;
        }
        return api
          .get("teachers/", { params: { ordering: "highest_rated" } })
          .then((r2) => {
            const fallback = normalizeTeachers(unwrapList(r2));
            if (fallback.length) setFeatured(fallback.slice(0, 4));
          });
      })
      .catch(() => {
        /* keep sample */
      });
  }, []);

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-dark via-primary to-primary-dark text-primary-foreground">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 80% 70%, white 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-28 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium border border-white/20">
              <ShieldCheck className="h-3.5 w-3.5" /> Verified Teachers · Background Checked
            </span>
            <h1 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight">
              Learn Quran with <span className="text-gold">Verified Teachers</span> — Online & Nearby
            </h1>
            <p className="mt-5 text-lg text-primary-foreground/85 max-w-xl">
              Connect with qualified Quran teachers for one-on-one lessons in Noorani Qaida, Nazra, Tajweed, Hifz, and Islamic Studies — anywhere in the world.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/teachers"
                className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 font-semibold text-primary hover:bg-white/90 transition"
              >
                <Search className="h-4 w-4" /> Find a Teacher
              </Link>
              <Link
                to="/register/teacher"
                className="inline-flex items-center gap-2 rounded-md border border-white/30 bg-white/10 px-5 py-3 font-semibold text-primary-foreground hover:bg-white/20 transition"
              >
                Become a Teacher <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="hidden lg:block relative">
            <div className="absolute -inset-4 rounded-3xl bg-gold/20 blur-3xl" />
            <div className="relative grid grid-cols-2 gap-4">
              {SAMPLE_TEACHERS.slice(0, 4).map((t, i) => (
                <div
                  key={t.id}
                  className={`rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 p-5 ${i % 2 === 0 ? "translate-y-4" : ""}`}
                >
                  <div className="h-12 w-12 rounded-full bg-gold/30 flex items-center justify-center font-bold">
                    {t.full_name?.charAt(0)}
                  </div>
                  <p className="mt-3 font-semibold">{t.full_name}</p>
                  <p className="text-xs text-primary-foreground/70">{t.subjects?.join(" · ")}</p>
                  <p className="mt-2 text-xs text-gold">★ {t.rating} ({t.reviews_count})</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            { icon: ShieldCheck, value: "500+", label: "Verified Teachers" },
            { icon: Users, value: "10,000+", label: "Active Students" },
            { icon: Globe2, value: "5", label: "Countries Served" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <s.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-3xl font-bold text-foreground">{s.value}</p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-surface">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-foreground">How NoorConnect Works</h2>
            <p className="mt-3 text-muted-foreground">Start your Quran journey in three simple steps.</p>
          </div>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {[
              { icon: Search, title: "Search", desc: "Browse verified teachers by subject, city, gender, and rating." },
              { icon: Calendar, title: "Book", desc: "Pick a free trial or paid session at a time that suits you." },
              { icon: Video, title: "Learn", desc: "Join the live class via embedded Google Meet — anywhere, any device." },
            ].map((step, i) => (
              <div key={step.title} className="relative rounded-xl border border-border bg-card p-6">
                <div className="absolute -top-3 -left-3 h-8 w-8 rounded-full bg-gold text-gold-foreground flex items-center justify-center font-bold text-sm">
                  {i + 1}
                </div>
                <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <step.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-semibold text-lg">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED TEACHERS */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
          <div>
            <h2 className="text-3xl font-bold">Featured Teachers</h2>
            <p className="mt-2 text-muted-foreground">Top-rated, fully verified instructors.</p>
          </div>
          <Link to="/teachers" className="text-sm font-semibold text-primary hover:underline inline-flex items-center gap-1">
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {featured.map((t) => (
            <TeacherCard key={t.id} teacher={t} />
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="bg-surface">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-3xl font-bold text-center">What Families Say</h2>
          <div className="mt-10 grid md:grid-cols-3 gap-6">
            {[
              { name: "Fatima A.", role: "Parent of two", quote: "My kids look forward to every lesson. The teacher is patient and the platform is so easy to use." },
              { name: "Omar S.", role: "Adult learner", quote: "I started Tajweed at 32. My teacher made it feel approachable. Highly recommended." },
              { name: "Zainab K.", role: "Parent", quote: "Verified teachers gave us peace of mind. Booking and joining the class is effortless." },
            ].map((t) => (
              <div key={t.name} className="rounded-xl bg-card border border-border p-6">
                <Quote className="h-6 w-6 text-gold" />
                <p className="mt-3 text-foreground/90">{t.quote}</p>
                <div className="mt-5 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
