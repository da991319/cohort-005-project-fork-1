import { loadLessonPage } from "./lib/load.server";

export { loadLessonPage };
export { markLessonComplete } from "./lib/progress.server";
export { getCommentById } from "./lib/thread.server";
export { computeResult, getQuizById } from "./lib/quiz.server";

/** What the lesson page renders: a locked preview or the full lesson. */
export type LessonPageData = Awaited<ReturnType<typeof loadLessonPage>>;
