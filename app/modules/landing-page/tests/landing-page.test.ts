import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "~/db/schema";
import { CourseStatus } from "~/db/schema";
import { markdown } from "~/lib/text";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import { createLandingPage } from "../index.server";

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
});

const load = () => createLandingPage(db).load();

function addCourse(
  slug: string,
  options: {
    status?: CourseStatus;
    createdAt?: string;
    categoryId?: number;
    instructorId?: number;
  } = {}
) {
  return db
    .insert(schema.courses)
    .values({
      title: slug,
      slug,
      description: `About ${slug}`,
      salesCopy: markdown(`## ${slug}`),
      instructorId: options.instructorId ?? base.instructor.id,
      categoryId: options.categoryId ?? base.category.id,
      status: options.status ?? CourseStatus.Published,
      ...(options.createdAt ? { createdAt: options.createdAt } : {}),
    })
    .returning()
    .get();
}

function addLessons(courseId: number, perModule: number[]) {
  perModule.forEach((count, moduleIndex) => {
    const mod = db
      .insert(schema.modules)
      .values({ courseId, title: `M${moduleIndex}`, position: moduleIndex })
      .returning()
      .get();
    for (let position = 0; position < count; position++) {
      db.insert(schema.lessons)
        .values({ moduleId: mod.id, title: `L${position}`, position })
        .run();
    }
  });
}

describe("featured courses", () => {
  it("shows the three newest published courses, newest first", () => {
    db.update(schema.courses).set({ createdAt: "2019-01-01 00:00:00" }).run();
    addCourse("newest", { createdAt: "2023-01-01 00:00:00" });
    addCourse("middle", { createdAt: "2021-01-01 00:00:00" });
    addCourse("oldest", { createdAt: "2020-01-01 00:00:00" });
    addCourse("newer", { createdAt: "2022-01-01 00:00:00" });
    addCourse("draft", {
      status: CourseStatus.Draft,
      createdAt: "2030-01-01 00:00:00",
    });

    expect(load().featuredCourses.map((c) => c.slug)).toEqual([
      "newest",
      "newer",
      "middle",
    ]);
  });

  it("counts every lesson across a course's modules", () => {
    addLessons(base.course.id, [2, 3]);

    const [course] = load().featuredCourses;

    expect(course).toMatchObject({
      slug: "test-course",
      lessonCount: 5,
      instructorName: "Test Instructor",
      categoryName: "Programming",
    });
  });

  it("gives a course with no lessons a lesson count of zero", () => {
    expect(load().featuredCourses[0].lessonCount).toBe(0);
  });
});

describe("catalogue stats", () => {
  it("counts only what published courses span", () => {
    const design = db
      .insert(schema.categories)
      .values({ name: "Design", slug: "design" })
      .returning()
      .get();
    db.insert(schema.categories).values({ name: "Empty", slug: "empty" }).run();
    const other = db
      .insert(schema.users)
      .values({
        name: "Other",
        email: "other@example.com",
        role: schema.UserRole.Instructor,
      })
      .returning()
      .get();
    const second = addCourse("second", { categoryId: design.id });
    const draft = addCourse("draft", {
      status: CourseStatus.Draft,
      instructorId: other.id,
    });
    const archived = addCourse("archived", {
      status: CourseStatus.Archived,
      instructorId: other.id,
    });
    addLessons(base.course.id, [1, 2]);
    addLessons(second.id, [4]);
    addLessons(draft.id, [10]);
    addLessons(archived.id, [10]);

    expect(load().stats).toEqual({
      courses: 2,
      categories: 2,
      instructors: 1,
      lessons: 7,
    });
  });

  it("is all zeroes with nothing published", () => {
    db.update(schema.courses).set({ status: CourseStatus.Draft }).run();

    expect(load()).toEqual({
      featuredCourses: [],
      stats: { courses: 0, categories: 0, instructors: 0, lessons: 0 },
    });
  });
});
