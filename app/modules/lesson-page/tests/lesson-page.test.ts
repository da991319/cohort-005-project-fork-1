import { describe, it, expect, beforeEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { getCommentById, markLessonComplete } from "../index.server";

let testDb: TestDb;

// The module reads ~/db directly; point it at a fresh in-memory database.
vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

let userId: number;
let lessonId: number;

beforeEach(() => {
  testDb = createTestDb();
  const base = seedBaseData(testDb);
  userId = base.user.id;
  const module = testDb
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();
  lessonId = testDb
    .insert(schema.lessons)
    .values({ moduleId: module.id, title: "Lesson 1", position: 1 })
    .returning()
    .get().id;
});

function progressRows() {
  return testDb
    .select()
    .from(schema.lessonProgress)
    .where(eq(schema.lessonProgress.lessonId, lessonId))
    .all();
}

describe("markLessonComplete", () => {
  it("records a completed lesson the learner had not started", () => {
    const progress = markLessonComplete(userId, lessonId);

    expect(progress.status).toBe(schema.LessonProgressStatus.Completed);
    expect(progress.completedAt).not.toBeNull();
    expect(progressRows()).toHaveLength(1);
  });

  it("completes existing progress instead of adding a second row", () => {
    markLessonComplete(userId, lessonId);
    markLessonComplete(userId, lessonId);

    expect(progressRows()).toHaveLength(1);
  });
});

describe("getCommentById", () => {
  it("returns nothing for a comment that does not exist", () => {
    expect(getCommentById(999)).toBeUndefined();
  });
});
