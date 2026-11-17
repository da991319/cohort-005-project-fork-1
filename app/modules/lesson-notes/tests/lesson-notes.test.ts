import { describe, it, expect } from "vitest";
import { describeNoteDraft } from "../index";

describe("describeNoteDraft", () => {
  it("cannot save an empty box when there is no note yet", () => {
    const state = describeNoteDraft("", null);
    expect(state.unsaved).toBe(false);
    expect(state.canSave).toBe(false);
  });

  it("can save new text", () => {
    const state = describeNoteDraft("Generics are like parameters", null);
    expect(state.unsaved).toBe(true);
    expect(state.canSave).toBe(true);
    expect(state.length).toBe(28);
  });

  it("has nothing to save when the text matches the saved note", () => {
    const state = describeNoteDraft("same", "same");
    expect(state.unsaved).toBe(false);
    expect(state.canSave).toBe(false);
  });

  it("treats trailing whitespace as already saved, since saving trims it", () => {
    const state = describeNoteDraft("same \n", "same");
    expect(state.unsaved).toBe(false);
    expect(state.canSave).toBe(false);
  });

  it("cannot save whitespace only", () => {
    const state = describeNoteDraft("   \n", "old");
    expect(state.empty).toBe(true);
    expect(state.canSave).toBe(false);
  });

  it("allows exactly the limit and refuses one character over", () => {
    const atLimit = describeNoteDraft("a".repeat(2000), null);
    expect(atLimit.limit).toBe(2000);
    expect(atLimit.tooLong).toBe(false);
    expect(atLimit.canSave).toBe(true);

    const over = describeNoteDraft("a".repeat(2001), null);
    expect(over.tooLong).toBe(true);
    expect(over.canSave).toBe(false);
  });
});
