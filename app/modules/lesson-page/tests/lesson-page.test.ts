import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";

// The module reads the shared `~/db` rather than taking the database as an
// argument, so the test swaps that connection for an in-memory one.
const testDb = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("~/db", () => ({
  get db() {
    return testDb.current;
  },
}));

const { markLessonComplete } = await import("../index.server");

function seedLesson(db: TestDb) {
  const { user, course } = seedBaseData(db);
  const mod = db
    .insert(schema.modules)
    .values({ courseId: course.id, title: "Basics", position: 1 })
    .returning()
    .get();
  const lesson = db
    .insert(schema.lessons)
    .values({ moduleId: mod.id, title: "Intro", position: 1 })
    .returning()
    .get();
  return { user, lesson };
}

describe("markLessonComplete", () => {
  let db: TestDb;

  beforeEach(() => {
    db = createTestDb();
    testDb.current = db;
  });

  it("records the lesson as completed", () => {
    const { user, lesson } = seedLesson(db);

    const progress = markLessonComplete(user.id, lesson.id);

    expect(progress.status).toBe(schema.LessonProgressStatus.Completed);
    expect(progress.completedAt).not.toBeNull();
  });

  it("updates the existing progress row instead of adding another", () => {
    const { user, lesson } = seedLesson(db);

    const first = markLessonComplete(user.id, lesson.id);
    const second = markLessonComplete(user.id, lesson.id);

    expect(second.id).toBe(first.id);
    expect(db.select().from(schema.lessonProgress).all()).toHaveLength(1);
  });
});
