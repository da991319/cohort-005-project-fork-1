import { courses, lessons, modules } from "~/db/schema";

// The Lesson and Course a Bookmark or Note points at, so a row on the Saved
// page can link back to its Lesson and name its Course.
export const savedLessonColumns = {
  lessonId: lessons.id,
  lessonTitle: lessons.title,
  moduleTitle: modules.title,
  courseTitle: courses.title,
  courseSlug: courses.slug,
};
