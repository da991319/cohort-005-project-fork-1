import { MAX_NOTE_LENGTH } from "~/lib/notes";

export type NoteDraftState = {
  length: number;
  limit: number;
  tooLong: boolean;
  empty: boolean;
  unsaved: boolean;
  canSave: boolean;
};

/**
 * What the note editor should show for the text in the box, given the note
 * as last saved (`null` when the Student has never saved one).
 */
export function describeNoteDraft(
  draft: string,
  savedBody: string | null
): NoteDraftState {
  const tooLong = draft.length > MAX_NOTE_LENGTH;
  const trimmed = draft.trim();
  const empty = trimmed.length === 0;
  // Saving trims the body, so compare what would be stored, not the raw box.
  const unsaved = trimmed !== (savedBody ?? "");

  return {
    length: draft.length,
    limit: MAX_NOTE_LENGTH,
    tooLong,
    empty,
    unsaved,
    canSave: unsaved && !empty && !tooLong,
  };
}
