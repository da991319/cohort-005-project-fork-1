import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { QuestionType } from "~/db/schema";
import { markdown } from "~/lib/text";
import { createCoursePermissions } from "~/modules/permissions/course-permissions.server";
import type { Person } from "~/modules/permissions/person.server";
import { createLessonPage } from "../index.server";

type Lesson = typeof schema.lessons.$inferSelect;

/** A published course with one module of three lessons, and a test database. */
export type World = ReturnType<typeof seedBaseData> & {
  db: TestDb;
  lessonPage: ReturnType<typeof createLessonPage>;
  first: Lesson;
  second: Lesson;
  third: Lesson;
};

export function createWorld(): World {
  const db = createTestDb();
  const base = seedBaseData(db);
  const mod = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();
  const [first, second, third] = ["First", "Second", "Third"].map((title, i) =>
    addLesson(db, { moduleId: mod.id, title, position: i + 1 })
  );
  return {
    ...base,
    db,
    lessonPage: createLessonPage(db),
    first,
    second,
    third,
  };
}

export function addLesson(
  db: TestDb,
  lesson: { moduleId: number; title: string; position: number }
) {
  return db
    .insert(schema.lessons)
    .values({
      ...lesson,
      content: markdown(`# ${lesson.title}\n\nBody of ${lesson.title}.`),
    })
    .returning()
    .get();
}

export const student = (w: World): Person => ({
  id: w.user.id,
  role: "student",
  country: null,
});

export const instructor = (w: World): Person => ({
  id: w.instructor.id,
  role: "instructor",
  country: null,
});

/** Enrols the seeded student in the seeded course. */
export function enrol(w: World) {
  w.db
    .insert(schema.enrollments)
    .values({ userId: w.user.id, courseId: w.course.id })
    .run();
}

/** Decides for real, through the permissions module, then loads the page. */
export function loadPage(w: World, person: Person | null, lessonId: number) {
  const decisions = createCoursePermissions(w.db).decide(person, {
    courseId: w.course.id,
    lessonId,
  });
  if (!decisions.found) throw new Error("course not found");
  return w.lessonPage.load(decisions, lessonId);
}

export async function loadFullPage(
  w: World,
  person: Person | null,
  lessonId: number
) {
  const page = await loadPage(w, person, lessonId);
  if (page.view !== "full") throw new Error(`expected full, got ${page.view}`);
  return page;
}

/**
 * A quiz on the second lesson, one question per type given, each with a right
 * and a wrong option.
 */
export function addQuiz(
  w: World,
  types: QuestionType[] = [QuestionType.MultipleChoice, QuestionType.TrueFalse]
) {
  const quiz = w.db
    .insert(schema.quizzes)
    .values({ lessonId: w.second.id, title: "Check", passingScore: 0.7 })
    .returning()
    .get();
  const questions = types.map((questionType, i) => {
    const question = w.db
      .insert(schema.quizQuestions)
      .values({
        quizId: quiz.id,
        questionText: `Q${i + 1}`,
        questionType,
        position: i + 1,
      })
      .returning()
      .get();
    const [right, wrong] = [true, false].map(
      (isCorrect) =>
        w.db
          .insert(schema.quizOptions)
          .values({
            questionId: question.id,
            optionText: isCorrect ? "Right" : "Wrong",
            isCorrect,
          })
          .returning()
          .get().id
    );
    return { questionId: question.id, right, wrong };
  });
  return { quizId: quiz.id, questions };
}
