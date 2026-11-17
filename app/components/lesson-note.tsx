import { useState } from "react";
import { useFetcher } from "react-router";
import { Lock, NotebookPen } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { cn, formatRelativeTime } from "~/lib/utils";
import { describeNoteDraft } from "~/modules/lesson-notes";

export type LessonNoteData = { body: string; updatedAt: string } | null;

// Laid out like CommentThread so the two cards read as one family on the page.
export function LessonNote({ note }: { note: LessonNoteData }) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [draft, setDraft] = useState(note?.body ?? "");
  const isSaving = fetcher.state !== "idle";
  const error = fetcher.state === "idle" ? fetcher.data?.error : undefined;
  const state = describeNoteDraft(draft, note?.body ?? null);

  return (
    <Card className="mb-8">
      <CardContent className="px-6">
        <NoteHeader />

        <fetcher.Form method="post" className="space-y-2">
          <input type="hidden" name="intent" value="save-note" />
          <Textarea
            name="body"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            placeholder="Jot down what clicked, what to revisit, or a question to ask below..."
            aria-label="Your notes"
            className="min-h-24 resize-y"
          />
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              size="sm"
              disabled={isSaving || !state.canSave}
            >
              {isSaving ? "Saving..." : "Save note"}
            </Button>
            <NoteStatus
              error={error}
              unsaved={state.unsaved}
              updatedAt={note?.updatedAt ?? null}
            />
            <span
              className={cn(
                "ml-auto text-xs",
                state.tooLong ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {state.length} / {state.limit}
            </span>
          </div>
        </fetcher.Form>
      </CardContent>
    </Card>
  );
}

function NoteStatus({
  error,
  unsaved,
  updatedAt,
}: {
  error: string | undefined;
  unsaved: boolean;
  updatedAt: string | null;
}) {
  if (error) return <span className="text-sm text-destructive">{error}</span>;
  if (unsaved && updatedAt) {
    return (
      <span className="text-xs text-muted-foreground">Unsaved changes</span>
    );
  }
  if (!updatedAt) return null;
  return (
    <span suppressHydrationWarning className="text-xs text-muted-foreground">
      Saved {formatRelativeTime(updatedAt)}
    </span>
  );
}

function NoteHeader() {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <NotebookPen className="size-5 text-primary" />
        <h2 className="text-xl font-semibold">Your notes</h2>
      </div>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Lock className="size-3" />
        Only you can see these
      </span>
    </div>
  );
}
