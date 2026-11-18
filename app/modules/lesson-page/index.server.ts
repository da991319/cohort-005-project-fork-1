import { db } from "~/db";
import type { CourseDecisions } from "~/modules/permissions/course-permissions.server";
import type { Db } from "./lib/database";
import { loadLessonPage } from "./lib/load.server";
import { markLessonComplete } from "./lib/progress.server";
import { getCommentById } from "./lib/thread.server";
import { computeResult, getQuizById } from "./lib/quiz.server";

/** What the lesson page renders: a locked preview or the full lesson. */
export type LessonPageData = Awaited<ReturnType<typeof loadLessonPage>>;

/**
 * The lesson page bound to a database. The app uses `lessonPage`, which reads
 * the app database; tests build their own against a test database.
 */
export function createLessonPage(database: Db) {
  return {
    /**
     * Everything the lesson page shows. Someone who can't view the course gets
     * the locked preview; anyone else gets the full lesson, and a Person who
     * can take the course has the lesson marked in progress. Throws 404 when
     * the lesson or its module is missing.
     */
    load(
      decisions: Extract<CourseDecisions, { found: true }>,
      lessonId: number
    ) {
      return loadLessonPage(database, decisions, lessonId);
    },

    markLessonComplete(userId: number, lessonId: number) {
      return markLessonComplete(database, userId, lessonId);
    },

    getCommentById(commentId: number) {
      return getCommentById(database, commentId);
    },

    getQuizById(quizId: number) {
      return getQuizById(database, quizId);
    },

    /**
     * Grades the answers (question id → option id), records the attempt and
     * returns the result, or null when the quiz doesn't exist.
     */
    computeResult(
      userId: number,
      quizId: number,
      selectedAnswers: Record<number, number>
    ) {
      return computeResult(database, { userId, quizId, selectedAnswers });
    },
  };
}

// Pure so a route importing this only for its loader doesn't pull the
// database into the client bundle (see `~/db`).
export const lessonPage = /* @__PURE__ */ createLessonPage(db);
