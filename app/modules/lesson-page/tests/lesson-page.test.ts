import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";

// The module reads the shared `~/db` rather than taking the database as an
// argument, so the test swaps that connection for an in-memory one.
const testDb = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("~/db", () => ({
  db: new Proxy(
    {},
    {
      get(_target, prop) {
        const target = testDb.current as object;
        const value = Reflect.get(target, prop);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }
  ),
}));

const { computeResult, markLessonComplete } = await import("../index.server");

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let lessonId: number;

beforeEach(() => {
  db = createTestDb();
  testDb.current = db;
  base = seedBaseData(db);
  const mod = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Module", position: 1 })
    .returning()
    .get();
  lessonId = db
    .insert(schema.lessons)
    .values({ moduleId: mod.id, title: "Lesson", position: 1 })
    .returning()
    .get().id;
});

describe("markLessonComplete", () => {
  it("records a first completion", () => {
    const progress = markLessonComplete(base.user.id, lessonId);

    expect(progress.status).toBe(schema.LessonProgressStatus.Completed);
    expect(progress.completedAt).not.toBeNull();
  });

  it("completes a lesson it has seen before without a second row", () => {
    const first = markLessonComplete(base.user.id, lessonId);
    const second = markLessonComplete(base.user.id, lessonId);

    expect(second.id).toBe(first.id);
  });
});

describe("computeResult", () => {
  function addQuestion(quizId: number, position: number) {
    const question = db
      .insert(schema.quizQuestions)
      .values({
        quizId,
        questionText: `Question ${position}`,
        questionType: schema.QuestionType.MultipleChoice,
        position,
      })
      .returning()
      .get();
    const [right, wrong] = [true, false].map(
      (isCorrect) =>
        db
          .insert(schema.quizOptions)
          .values({ questionId: question.id, optionText: "x", isCorrect })
          .returning()
          .get().id
    );
    return { questionId: question.id, right, wrong };
  }

  it("scores the answers and records the attempt", () => {
    const quizId = db
      .insert(schema.quizzes)
      .values({ lessonId, title: "Quiz", passingScore: 0.7 })
      .returning()
      .get().id;
    const q1 = addQuestion(quizId, 1);
    const q2 = addQuestion(quizId, 2);

    const result = computeResult(base.user.id, quizId, {
      [q1.questionId]: q1.right,
      [q2.questionId]: q2.wrong,
    });

    expect(result).toMatchObject({
      score: 0.5,
      passed: false,
      totalCorrect: 1,
      totalQuestions: 2,
    });
    expect(db.select().from(schema.quizAttempts).all()).toHaveLength(1);
  });
});
