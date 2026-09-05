import { describe, expect, it } from "vitest";
import { retainSelectedCandidate, type StudySourceDefinition } from "../src/features/study/multi-source-study-session";
import type { DeckDefinition, StudyCard } from "../src/features/study/types";

const one: StudyCard = { id: "one", deckId: "test", front: "one", back: "1" };
const two: StudyCard = { id: "two", deckId: "test", front: "two", back: "2" };
const deck: DeckDefinition = { id: "test", slug: "test", title: "Test", eyebrow: "Test", description: "Test", language: "latin", cards: [one, two], supportsReverse: true };
function source(cards: StudyCard[]): StudySourceDefinition { return { id: "source", label: "Source", deck, cards, studyKey: "forward", direction: "forward" }; }

describe("study filter retention", () => {
  it("keeps the current card when it remains inside the newly filtered pool", () => {
    const current = { source: source([one, two]), card: one };
    const retained = retainSelectedCandidate(current, [source([one])]);
    expect(retained?.card.id).toBe("one");
  });

  it("drops the current card only when the new filter excludes it", () => {
    const current = { source: source([one, two]), card: one };
    expect(retainSelectedCandidate(current, [source([two])])).toBeNull();
  });
});
