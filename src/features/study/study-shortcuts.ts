import type { ReviewDifficulty, ReviewResult } from "./types";

export type StudyShortcut =
  | { type: "start" }
  | { type: "reveal" }
  | { type: "flip" }
  | { type: "result"; value: ReviewResult }
  | { type: "difficulty"; value: ReviewDifficulty }
  | { type: "save" }
  | null;

type ShortcutContext = {
  key: string;
  startGateOpen: boolean;
  revealed: boolean;
  result: ReviewResult | null;
  difficulty: ReviewDifficulty | null;
  typingTarget: boolean;
  controlsTarget?: boolean;
};

export function studyShortcut({ key, startGateOpen, revealed, result, difficulty, typingTarget, controlsTarget = false }: ShortcutContext): StudyShortcut {
  // Toolbar/select controls keep their normal keyboard behavior while the timer gate is open.
  if (typingTarget || controlsTarget) return null;
  // Outside those controls, the gate owns the first keypress. It must never leak through.
  if (startGateOpen) return { type: "start" };
  if (key === " " && !revealed) return { type: "reveal" };
  if (!revealed) return null;

  const normalized = key.toLowerCase();
  if (normalized === "r") return { type: "result", value: "right" };
  if (normalized === "w") return { type: "result", value: "wrong" };
  if (key === "1") return { type: "difficulty", value: "easy" };
  if (key === "2") return { type: "difficulty", value: "medium" };
  if (key === "3") return { type: "difficulty", value: "hard" };
  if (key === "Enter") return { type: "flip" };
  if (key === " " && result && difficulty) return { type: "save" };
  return null;
}
