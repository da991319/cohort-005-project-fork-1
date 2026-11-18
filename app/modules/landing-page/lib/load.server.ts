import { countDistinct, desc, eq, sql } from "drizzle-orm";
import {
  categories,
  courses,
  CourseStatus,
  lessons,
  modules,
  users,
} from "~/db/schema";
import type { Db } from "./database";

const FEATURED_COURSE_LIMIT = 3;

const isPublished = eq(courses.status, CourseStatus.Published);

function loadFeaturedCourses(database: Db) {
  return database
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      description: courses.description,
      coverImageUrl: courses.coverImageUrl,
      instructorName: users.name,
      categoryName: categories.name,
      lessonCount: countDistinct(lessons.id),
    })
    .from(courses)
    .innerJoin(users, eq(courses.instructorId, users.id))
    .innerJoin(categories, eq(courses.categoryId, categories.id))
    .leftJoin(modules, eq(modules.courseId, courses.id))
    .leftJoin(lessons, eq(lessons.moduleId, modules.id))
    .where(isPublished)
    .groupBy(courses.id)
    .orderBy(desc(courses.createdAt), desc(courses.id))
    .limit(FEATURED_COURSE_LIMIT)
    .all();
}

function loadCatalogueStats(database: Db) {
  const catalogue = database
    .select({
      courses: countDistinct(courses.id),
      categories: countDistinct(courses.categoryId),
      instructors: countDistinct(courses.instructorId),
    })
    .from(courses)
    .where(isPublished)
    .get();

  const lessonTotal = database
    .select({ lessons: sql<number>`count(*)` })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .innerJoin(courses, eq(modules.courseId, courses.id))
    .where(isPublished)
    .get();

  return {
    courses: catalogue?.courses ?? 0,
    categories: catalogue?.categories ?? 0,
    instructors: catalogue?.instructors ?? 0,
    lessons: lessonTotal?.lessons ?? 0,
  };
}

export function loadLandingPage(database: Db) {
  return {
    featuredCourses: loadFeaturedCourses(database),
    stats: loadCatalogueStats(database),
  };
}
