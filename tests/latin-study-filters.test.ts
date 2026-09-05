import { describe, expect, it } from "vitest";
import { grammarFormGroups, HENLE_PART1_SECTIONS, matchesGrammarCard, matchesVocabularyCard, vocabularyFamily } from "../src/features/study/latin-study-filters";
import type { StudyCard } from "../src/features/study/types";

const grammarCard = (overrides: Partial<StudyCard> = {}): StudyCard => ({
  id: "verb",
  deckId: "henle-part1-forms",
  front: "amat",
  back: "he/she/it loves",
  category: "Verbs",
  metadata: { studySubsection: "Regular Verbs — Active Voice", voiceGroup: "Active Voice", formGroup: "Indicative" },
  ...overrides,
});

describe("Latin hierarchical filters", () => {
  it("keeps every Henle Part I grammatical section available", () => {
    expect(HENLE_PART1_SECTIONS).toEqual(["Nouns", "Adjectives", "Adverbs", "Numerals", "Pronouns", "Verbs"]);
  });

  it("intersects verb section, voice, mood/form, and family", () => {
    const card = grammarCard();
    expect(matchesGrammarCard(card, {
      sections: new Set(["Verbs"]),
      voices: new Set(["Active Voice"]),
      formGroups: new Set(["Indicative"]),
      verbSubsections: new Set(["Regular Verbs — Active Voice"]),
    })).toBe(true);
    expect(matchesGrammarCard(card, {
      sections: new Set(["Verbs"]),
      voices: new Set(["Passive Voice"]),
      formGroups: new Set(["Indicative"]),
      verbSubsections: null,
    })).toBe(false);
  });

  it("does not let verb-specific narrowing remove selected non-verb sections", () => {
    const noun = grammarCard({ id: "noun", category: "Nouns", metadata: { studySubsection: "Nouns" } });
    expect(matchesGrammarCard(noun, {
      sections: new Set(["Nouns", "Verbs"]),
      voices: new Set(["Active Voice"]),
      formGroups: new Set(["Indicative"]),
      verbSubsections: new Set(["Regular Verbs — Active Voice"]),
    })).toBe(true);
  });

  it("supports charts that contain more than one form group", () => {
    const chart = grammarCard({ metadata: { voiceGroup: "Active Voice", studySubsection: "Regular Verbs — Active Voice", formGroups: ["Indicative", "Subjunctive"] } });
    expect(grammarFormGroups(chart)).toEqual(["Indicative", "Subjunctive"]);
    expect(matchesGrammarCard(chart, { sections: null, voices: null, formGroups: new Set(["Subjunctive"]), verbSubsections: null })).toBe(true);
  });

  it("allows multiple vocabulary parts of speech to be selected together", () => {
    const noun = grammarCard({ deckId: "dickinson-latin-core", category: "Noun: 1st Declension", metadata: { partOfSpeech: "Noun: 1st Declension" } });
    const verb = grammarCard({ deckId: "dickinson-latin-core", category: "Verb: 1st Conjugation", metadata: { partOfSpeech: "Verb: 1st Conjugation" } });
    const selected = new Set(["Noun: 1st Declension", "Verb: 1st Conjugation"]);
    expect(matchesVocabularyCard(noun, selected)).toBe(true);
    expect(matchesVocabularyCard(verb, selected)).toBe(true);
    expect(vocabularyFamily("Verb: 1st Conjugation")).toBe("Verb");
  });
});
