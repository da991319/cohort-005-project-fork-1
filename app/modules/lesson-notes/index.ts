import { describeDraft, type NoteDraftState } from "./lib/draft";

export type { NoteDraftState };

/**
 * What the note editor should show for the text in the box, given the note
 * as last saved (`null` when the Student has never saved one).
 */
export function describeNoteDraft(
  draft: string,
  savedBody: string | null
): NoteDraftState {
  return describeDraft(draft, savedBody);
}
