import type { LucideIcon } from "lucide-react";
import { BookOpen, GraduationCap, Layers, Users } from "lucide-react";
import type { CatalogueStats } from "./types";

export function LandingStats({ stats }: { stats: CatalogueStats }) {
  const items: { icon: LucideIcon; value: number; label: string }[] = [
    { icon: BookOpen, value: stats.courses, label: "Published courses" },
    { icon: Layers, value: stats.lessons, label: "Lessons to work through" },
    { icon: GraduationCap, value: stats.categories, label: "Topics covered" },
    { icon: Users, value: stats.instructors, label: "Expert instructors" },
  ];

  return (
    <section className="border-y border-border bg-muted/50 py-12">
      <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 lg:grid-cols-4">
        {items.map(({ icon: Icon, value, label }) => (
          <div key={label} className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="size-6 text-primary" />
            </div>
            <div className="flex flex-col-reverse">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="text-2xl font-bold">{value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}
