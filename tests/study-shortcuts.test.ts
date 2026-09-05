import { describe, expect, it } from "vitest";
import { studyShortcut } from "../src/features/study/study-shortcuts";

const context = { startGateOpen: false, revealed: false, result: null, difficulty: null, typingTarget: false } as const;

describe("study keyboard shortcuts", () => {
  it("uses the first key only to start when the gate is open", () => {
    expect(studyShortcut({ ...context, key: " ", startGateOpen: true })).toEqual({ type: "start" });
    expect(studyShortcut({ ...context, key: "1", startGateOpen: true, revealed: true })).toEqual({ type: "start" });
  });

  it("does not trigger study shortcuts while typing after the gate is dismissed", () => {
    expect(studyShortcut({ ...context, key: " ", typingTarget: true })).toBeNull();
  });

  it("reveals with space only when the front is still hidden", () => {
    expect(studyShortcut({ ...context, key: " " })).toEqual({ type: "reveal" });
    expect(studyShortcut({ ...context, key: " ", revealed: true })).toBeNull();
  });

  it("maps grading keys only after reveal", () => {
    expect(studyShortcut({ ...context, key: "1" })).toBeNull();
    expect(studyShortcut({ ...context, key: "1", revealed: true })).toEqual({ type: "result", value: "right" });
    expect(studyShortcut({ ...context, key: "5", revealed: true })).toEqual({ type: "difficulty", value: "hard" });
  });

  it("saves with Enter only when both grading inputs are complete", () => {
    expect(studyShortcut({ ...context, key: "Enter", revealed: true, result: "right" })).toBeNull();
    expect(studyShortcut({ ...context, key: "Enter", revealed: true, result: "right", difficulty: "medium" })).toEqual({ type: "save" });
  });
});
