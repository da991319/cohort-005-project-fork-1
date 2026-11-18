import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "~/db/schema";
import { QuestionType } from "~/db/schema";
import type { Person } from "~/modules/permissions/person.server";
import {
  addQuiz as addQuizTo,
  createWorld,
  enrol as enrolIn,
  loadFullPage,
  student as studentOf,
  type World,
} from "./fixtures";

let w: World;
let db: World["db"];
let base: World;
let lessonPage: World["lessonPage"];
let second: World["second"];

const loadFull = (person: Person | null, lessonId: number) =>
  loadFullPage(w, person, lessonId);
const student = () => studentOf(w);
const enrol = () => enrolIn(w);

const addQuiz = () => addQuizTo(w);
const addTrueFalseQuiz = (count: number) =>
  addQuizTo(
    w,
    Array.from({ length: count }, () => QuestionType.TrueFalse)
  );

beforeEach(() => {
  w = createWorld();
  ({ db, lessonPage, second } = w);
  base = w;
});

describe("computeResult", () => {
  it("passes when every answer is right and shows the best attempt on the page", async () => {
    enrol();
    const { quizId, questions } = addQuiz();

    const result = lessonPage.computeResult(
      base.user.id,
      quizId,
      Object.fromEntries(questions.map((q) => [q.questionId, q.right]))
    );

    expect(result).toMatchObject({
      score: 1,
      passed: true,
      grade: "A",
      totalCorrect: 2,
      totalQuestions: 2,
    });
    expect((await loadFull(student(), second.id)).bestAttempt).toEqual({
      score: 1,
      passed: true,
    });
  });

  it("marks an unanswered question wrong and fails at half marks", () => {
    const { quizId, questions } = addQuiz();
    const [answered, skipped] = questions;

    const result = lessonPage.computeResult(base.user.id, quizId, {
      [answered.questionId]: answered.right,
    });

    expect(result).toMatchObject({ score: 0.5, passed: false, grade: "F" });
    expect(result?.questionResults).toEqual([
      {
        questionId: answered.questionId,
        correct: true,
        selectedOptionId: answered.right,
        correctOptionId: answered.right,
      },
      {
        questionId: skipped.questionId,
        correct: false,
        selectedOptionId: null,
        correctOptionId: null,
      },
    ]);
  });

  it("reports the right option for a wrong answer on each question type", () => {
    const { quizId, questions } = addQuiz();

    const result = lessonPage.computeResult(
      base.user.id,
      quizId,
      Object.fromEntries(questions.map((q) => [q.questionId, q.wrong]))
    );

    expect(result).toMatchObject({ score: 0, totalCorrect: 0, grade: "F" });
    expect(result?.questionResults).toEqual(
      questions.map((q) => ({
        questionId: q.questionId,
        correct: false,
        selectedOptionId: q.wrong,
        correctOptionId: q.right,
      }))
    );
  });

  it.each([
    [9, "A"],
    [8, "B"],
    [7, "C"],
    [6, "D"],
    [5, "F"],
  ])("grades %i of 10 right as %s", (right, grade) => {
    const { quizId, questions } = addTrueFalseQuiz(10);
    const answers = Object.fromEntries(
      questions.map((q, i) => [q.questionId, i < right ? q.right : q.wrong])
    );

    const result = lessonPage.computeResult(base.user.id, quizId, answers);

    expect(result).toMatchObject({ score: right / 10, grade });
  });

  it.each([
    [8, true],
    [6, false],
  ])("with %i of 10 right, passed is %s", (right, passed) => {
    const { quizId, questions } = addTrueFalseQuiz(10);
    const answers = Object.fromEntries(
      questions.map((q, i) => [q.questionId, i < right ? q.right : q.wrong])
    );

    expect(
      lessonPage.computeResult(base.user.id, quizId, answers)?.passed
    ).toBe(passed);
  });

  it("scores a quiz with no questions as zero", () => {
    const { quizId } = addTrueFalseQuiz(0);

    expect(lessonPage.computeResult(base.user.id, quizId, {})).toMatchObject({
      score: 0,
      passed: false,
      totalQuestions: 0,
    });
  });

  it("records only the answers given", () => {
    const { quizId, questions } = addQuiz();
    const [answered] = questions;

    const result = lessonPage.computeResult(base.user.id, quizId, {
      [answered.questionId]: answered.wrong,
    });

    expect(
      db
        .select()
        .from(schema.quizAnswers)
        .where(eq(schema.quizAnswers.attemptId, result?.attemptId ?? -1))
        .all()
    ).toEqual([
      expect.objectContaining({
        questionId: answered.questionId,
        selectedOptionId: answered.wrong,
      }),
    ]);
  });

  it("returns null for a quiz that does not exist", () => {
    expect(lessonPage.computeResult(base.user.id, 9999, {})).toBeNull();
  });
});
