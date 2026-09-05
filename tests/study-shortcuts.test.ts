import { describe, expect, it } from "vitest";
import { studyShortcut } from "../src/features/study/study-shortcuts";

const context = { startGateOpen: false, revealed: false, result: null, difficulty: null, typingTarget: false } as const;

describe("study keyboard shortcuts", () => {
  it("uses the first key only to start when the gate is open", () => {
    expect(studyShortcut({ ...context, key: " ", startGateOpen: true })).toEqual({ type: "start" });
    expect(studyShortcut({ ...context, key: "r", startGateOpen: true, revealed: true })).toEqual({ type: "start" });
  });

  it("does not trigger study shortcuts while typing after the gate is dismissed", () => {
    expect(studyShortcut({ ...context, key: " ", typingTarget: true })).toBeNull();
  });

  it("uses space to reveal on the front and not to save before grading is complete", () => {
    expect(studyShortcut({ ...context, key: " " })).toEqual({ type: "reveal" });
    expect(studyShortcut({ ...context, key: " ", revealed: true })).toBeNull();
    expect(studyShortcut({ ...context, key: " ", revealed: true, result: "right" })).toBeNull();
  });

  it("maps R/W to correctness and 1/2/3 to difficulty only after reveal", () => {
    expect(studyShortcut({ ...context, key: "r" })).toBeNull();
    expect(studyShortcut({ ...context, key: "r", revealed: true })).toEqual({ type: "result", value: "right" });
    expect(studyShortcut({ ...context, key: "R", revealed: true })).toEqual({ type: "result", value: "right" });
    expect(studyShortcut({ ...context, key: "w", revealed: true })).toEqual({ type: "result", value: "wrong" });
    expect(studyShortcut({ ...context, key: "1", revealed: true })).toEqual({ type: "difficulty", value: "easy" });
    expect(studyShortcut({ ...context, key: "2", revealed: true })).toEqual({ type: "difficulty", value: "medium" });
    expect(studyShortcut({ ...context, key: "3", revealed: true })).toEqual({ type: "difficulty", value: "hard" });
  });

  it("saves with Space or Enter only when both grading inputs are complete", () => {
    expect(studyShortcut({ ...context, key: "Enter", revealed: true, result: "right" })).toBeNull();
    expect(studyShortcut({ ...context, key: "Enter", revealed: true, result: "right", difficulty: "medium" })).toEqual({ type: "save" });
    expect(studyShortcut({ ...context, key: " ", revealed: true, result: "wrong", difficulty: "hard" })).toEqual({ type: "save" });
  });
});
