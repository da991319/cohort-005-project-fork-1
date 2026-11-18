import { Link } from "react-router";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { CourseImage } from "~/components/course-image";
import type { CatalogueStats, FeaturedCourse } from "./types";

const SELLING_POINTS = [
  "Structured modules, lesson by lesson",
  "Quizzes that check you really got it",
  "Progress that picks up where you left off",
];

export function LandingHero({
  stats,
  featuredCourses,
  signedIn,
}: {
  stats: CatalogueStats;
  featuredCourses: FeaturedCourse[];
  signedIn: boolean;
}) {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-br from-transparent via-transparent to-primary/5" />
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.1fr_1fr] lg:py-28">
        <div>
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            {stats.courses} courses · {stats.lessons} lessons ·{" "}
            {stats.instructors} instructors
          </p>
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
            Learn to code,
            <br />
            <span className="text-muted-foreground">at your own pace</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Structured courses built by experienced instructors. Track your
            progress, take quizzes, and build real-world skills.
          </p>
          <ul className="mt-8 space-y-3">
            {SELLING_POINTS.map((point) => (
              <li key={point} className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="size-4 shrink-0 text-primary" />
                {point}
              </li>
            ))}
          </ul>
          <HeroActions signedIn={signedIn} />
        </div>
        <CoverStack courses={featuredCourses} />
      </div>
    </section>
  );
}

function HeroActions({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="mt-10 flex flex-wrap items-center gap-4">
      <Button asChild size="lg">
        <Link to="/courses">
          Browse Courses
          <ArrowRight className="ml-2 size-4" />
        </Link>
      </Button>
      <Button asChild size="lg" variant="outline">
        {signedIn ? (
          <Link to="/dashboard">Go to your dashboard</Link>
        ) : (
          <Link to="/signup">Create a free account</Link>
        )}
      </Button>
    </div>
  );
}

const STACK_POSITIONS = [
  "left-0 top-0 -rotate-6",
  "right-0 top-24 rotate-3",
  "left-10 bottom-0 -rotate-2",
];

function CoverStack({ courses }: { courses: FeaturedCourse[] }) {
  if (courses.length === 0) return null;

  return (
    <div className="relative hidden h-[460px] lg:block" aria-hidden="true">
      {courses.slice(0, STACK_POSITIONS.length).map((course, index) => (
        <div
          key={course.id}
          className={`absolute w-64 overflow-hidden rounded-xl border border-border bg-card shadow-xl ${STACK_POSITIONS[index]}`}
        >
          <CourseImage
            src={course.coverImageUrl}
            alt=""
            className="aspect-video w-full object-cover"
          />
          <div className="p-4">
            <p className="truncate text-sm font-semibold">{course.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {course.lessonCount} lessons · {course.instructorName}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
