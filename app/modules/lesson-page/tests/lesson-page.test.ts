import { describe, it, expect, beforeEach } from "vitest";
import { and, eq } from "drizzle-orm";
import * as schema from "~/db/schema";
import { LessonProgressStatus } from "~/db/schema";
import { markdown, plainText } from "~/lib/text";
import { createCoursePermissions } from "~/modules/permissions/course-permissions.server";
import type { Person } from "~/modules/permissions/person.server";
import {
  addLesson,
  addQuiz as addQuizTo,
  createWorld,
  enrol as enrolIn,
  instructor as instructorOf,
  loadFullPage,
  loadPage,
  student as studentOf,
  type World,
} from "./fixtures";

let w: World;
let db: World["db"];
let base: World;
let lessonPage: World["lessonPage"];
let second: World["second"];

const load = (person: Person | null, lessonId: number) =>
  loadPage(w, person, lessonId);
const loadFull = (person: Person | null, lessonId: number) =>
  loadFullPage(w, person, lessonId);
const student = () => studentOf(w);
const enrol = () => enrolIn(w);
let first: World["first"];
let third: World["third"];

const instructor = () => instructorOf(w);
const addQuiz = () => addQuizTo(w);

beforeEach(() => {
  w = createWorld();
  ({ db, lessonPage, first, second, third } = w);
  base = w;
});

// ─── Fixtures ───

function progressOf(lessonId: number) {
  return db
    .select()
    .from(schema.lessonProgress)
    .where(
      and(
        eq(schema.lessonProgress.userId, base.user.id),
        eq(schema.lessonProgress.lessonId, lessonId)
      )
    )
    .all();
}

function addVideo(lessonId: number, durationMinutes: number | null) {
  db.update(schema.lessons)
    .set({ videoUrl: "https://youtu.be/abc", durationMinutes })
    .where(eq(schema.lessons.id, lessonId))
    .run();
}

function watch(lessonId: number, positionSeconds: number, createdAt: string) {
  db.insert(schema.videoWatchEvents)
    .values({
      userId: base.user.id,
      lessonId,
      eventType: "progress",
      positionSeconds,
      createdAt,
    })
    .run();
}

function addUser(name: string, role: schema.UserRole) {
  return db
    .insert(schema.users)
    .values({ name, email: `${name.replaceAll(" ", ".")}@example.com`, role })
    .returning()
    .get();
}

function addComment(
  userId: number,
  body: string,
  extra: { parentId?: number; deletedAt?: string } = {}
) {
  return db
    .insert(schema.comments)
    .values({ lessonId: second.id, userId, body: markdown(body), ...extra })
    .returning()
    .get();
}

// ─── Loading the page ───

describe("load", () => {
  it("shows a signed-out visitor only the outline and why it is locked", async () => {
    const page = await load(null, second.id);

    expect(page).toEqual({
      view: "locked",
      course: {
        id: base.course.id,
        title: base.course.title,
        slug: base.course.slug,
      },
      curriculum: [
        {
          id: second.moduleId,
          title: "Basics",
          lessons: [
            { id: first.id, title: "First" },
            { id: second.id, title: "Second" },
            { id: third.id, title: "Third" },
          ],
        },
      ],
      module: { id: second.moduleId, title: "Basics" },
      lesson: { id: second.id, title: "Second" },
      enrolled: false,
      lockedReason: { kind: "signed-out" },
    });
  });

  it("locks the lesson for a signed-in Person who is not enrolled", async () => {
    const page = await load(student(), second.id);

    expect(page).toMatchObject({
      view: "locked",
      lockedReason: { kind: "not-enrolled" },
    });
    expect(progressOf(second.id)).toEqual([]);
  });

  it("gives an enrolled student the full lesson and marks it in progress", async () => {
    enrol();

    const page = await loadFull(student(), second.id);

    expect(page.contentHtml).toContain("Body of Second.");
    expect(page.prevLesson).toMatchObject({ id: first.id });
    expect(page.nextLesson).toMatchObject({ id: third.id });
    expect(page.lessonStatus).toBe(LessonProgressStatus.InProgress);
    expect(page.lessonProgressMap).toEqual({
      [second.id]: LessonProgressStatus.InProgress,
    });
    expect(page.currentUserId).toBe(base.user.id);
    expect(page.canModerate).toBe(false);
    expect(page.instructorName).toBe("Test Instructor");
  });

  it("has no previous lesson on the first lesson and no next on the last", async () => {
    enrol();

    expect((await loadFull(student(), first.id)).prevLesson).toBeNull();
    expect((await loadFull(student(), third.id)).nextLesson).toBeNull();
  });

  it("groups the outline by module and steps between lessons across modules", async () => {
    enrol();
    const later = db
      .insert(schema.modules)
      .values({ courseId: base.course.id, title: "Later", position: 2 })
      .returning()
      .get();
    const fourth = addLesson(db, {
      moduleId: later.id,
      title: "Fourth",
      position: 1,
    });

    const page = await loadFull(student(), fourth.id);

    expect(page.curriculum.map((m) => m.lessons.map((l) => l.title))).toEqual([
      ["First", "Second", "Third"],
      ["Fourth"],
    ]);
    expect(page.module).toEqual({ id: later.id, title: "Later" });
    expect(page.prevLesson).toEqual({
      id: third.id,
      title: "Third",
      moduleId: third.moduleId,
      moduleTitle: "Basics",
    });
  });

  it("maps progress only for this course's lessons", async () => {
    enrol();
    const elsewhere = db
      .insert(schema.courses)
      .values({
        title: "Elsewhere",
        slug: "elsewhere",
        description: "",
        salesCopy: markdown(""),
        instructorId: base.instructor.id,
        categoryId: base.category.id,
        status: schema.CourseStatus.Published,
      })
      .returning()
      .get();
    const otherModule = db
      .insert(schema.modules)
      .values({ courseId: elsewhere.id, title: "Other", position: 1 })
      .returning()
      .get();
    const otherLesson = addLesson(db, {
      moduleId: otherModule.id,
      title: "Other",
      position: 1,
    });
    lessonPage.markLessonComplete(base.user.id, otherLesson.id);
    lessonPage.markLessonComplete(base.user.id, first.id);

    const page = await loadFull(student(), second.id);

    expect(page.lessonProgressMap).toEqual({
      [first.id]: LessonProgressStatus.Completed,
      [second.id]: LessonProgressStatus.InProgress,
    });
  });

  it("resumes a video where it was last left and reports how far it was watched", async () => {
    enrol();
    addVideo(second.id, 10);
    watch(second.id, 450, "2026-01-01T10:00:00.000Z");
    watch(second.id, 120, "2026-01-01T11:00:00.000Z");

    const page = await loadFull(student(), second.id);

    expect(page.lastWatchPosition).toBe(120);
    expect(page.watchProgress).toBe(75);
  });

  it("caps watch progress at 100% and reports none for a video with no duration", async () => {
    enrol();
    addVideo(second.id, 1);
    watch(second.id, 90, "2026-01-01T10:00:00.000Z");
    addVideo(third.id, null);
    watch(third.id, 30, "2026-01-01T10:00:00.000Z");

    expect((await loadFull(student(), second.id)).watchProgress).toBe(100);
    const noDuration = await loadFull(student(), third.id);
    expect(noDuration.watchProgress).toBe(0);
    expect(noDuration.lastWatchPosition).toBe(30);
  });

  it("shows the student's bookmark and note on the lesson", async () => {
    enrol();
    db.insert(schema.bookmarks)
      .values({ userId: base.user.id, lessonId: second.id })
      .run();
    db.insert(schema.notes)
      .values({
        userId: base.user.id,
        lessonId: second.id,
        body: plainText("remember this"),
      })
      .run();

    const page = await loadFull(student(), second.id);

    expect(page.bookmarked).toBe(true);
    expect(page.note).toEqual({
      body: "remember this",
      updatedAt: expect.any(String),
    });
    expect((await loadFull(student(), third.id)).bookmarked).toBe(false);
  });

  it("does not record progress for the owning instructor, who can view but not take", async () => {
    const page = await loadFull(instructor(), second.id);

    expect(page.canModerate).toBe(true);
    expect(page.lessonStatus).toBeNull();
    expect(page.lessonProgressMap).toEqual({});
    expect(
      db
        .select()
        .from(schema.lessonProgress)
        .where(eq(schema.lessonProgress.lessonId, second.id))
        .all()
    ).toEqual([]);
  });

  it("throws 404 when the lesson does not exist", async () => {
    const decisions = createCoursePermissions(db).decide(instructor(), {
      courseId: base.course.id,
    });
    if (!decisions.found) throw new Error("course not found");

    await expect(lessonPage.load(decisions, 9999)).rejects.toMatchObject({
      init: { status: 404 },
    });
  });

  it("sends the quiz without saying which options are correct", async () => {
    enrol();
    addQuiz();

    const page = await loadFull(student(), second.id);

    expect(page.quiz?.questions).toHaveLength(2);
    for (const question of page.quiz?.questions ?? []) {
      for (const option of question.options) {
        expect(option).toEqual({
          id: expect.any(Number),
          optionText: expect.any(String),
        });
      }
    }
    expect(page.bestAttempt).toBeNull();
  });

  it("hides a deleted question with no replies and keeps one that has them", async () => {
    enrol();
    const now = new Date().toISOString();
    addComment(base.user.id, "gone", { deletedAt: now });
    const asked = addComment(base.user.id, "asked", { deletedAt: now });
    addComment(base.instructor.id, "**answer**", { parentId: asked.id });

    const { comments } = await loadFull(student(), second.id);

    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({
      deleted: true,
      body: "",
      bodyHtml: "",
      editedAt: null,
    });
    expect(comments[0].replies).toEqual([
      expect.objectContaining({
        bodyHtml: expect.stringContaining("<strong>answer</strong>"),
        author: expect.objectContaining({ isInstructor: true }),
      }),
    ]);
  });

  it("hides deleted replies and badges each author by their role", async () => {
    enrol();
    const admin = addUser("Ada Admin", schema.UserRole.Admin);
    const question = addComment(base.user.id, "question");
    addComment(admin.id, "from admin", { parentId: question.id });
    addComment(base.user.id, "withdrawn", {
      parentId: question.id,
      deletedAt: new Date().toISOString(),
    });

    const { comments } = await loadFull(student(), second.id);

    expect(comments).toHaveLength(1);
    expect(comments[0].author).toMatchObject({
      isInstructor: false,
      isPlatformAdmin: false,
    });
    expect(comments[0].replies).toHaveLength(1);
    expect(comments[0].replies[0].author).toMatchObject({
      name: "Ada Admin",
      isInstructor: false,
      isPlatformAdmin: true,
    });
  });
});

// ─── Progress ───

describe("markLessonComplete", () => {
  it("completes a lesson, and viewing it again does not move it back to in progress", async () => {
    enrol();
    await load(student(), second.id);

    lessonPage.markLessonComplete(base.user.id, second.id);
    const page = await loadFull(student(), second.id);

    expect(page.lessonStatus).toBe(LessonProgressStatus.Completed);
    expect(progressOf(second.id)).toHaveLength(1);
  });

  it("completes a lesson never opened before", () => {
    lessonPage.markLessonComplete(base.user.id, third.id);

    expect(progressOf(third.id)).toEqual([
      expect.objectContaining({
        status: LessonProgressStatus.Completed,
        completedAt: expect.any(String),
      }),
    ]);
  });
});

describe("lookups", () => {
  it("finds a comment and a quiz by id", () => {
    const comment = addComment(base.user.id, "hello");
    const { quizId } = addQuiz();

    expect(lessonPage.getCommentById(comment.id)?.body).toBe("hello");
    expect(lessonPage.getQuizById(quizId)?.lessonId).toBe(second.id);
    expect(lessonPage.getCommentById(9999)).toBeUndefined();
  });
});
