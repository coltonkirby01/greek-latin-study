import type { StudyCard } from "./types";

export type OptionalSelection = ReadonlySet<string> | null;

export const HENLE_PART1_SECTIONS = ["Nouns", "Adjectives", "Adverbs", "Numerals", "Pronouns", "Verbs"] as const;

export type GrammarCardFilters = {
  sections: OptionalSelection;
  verbSubsections: OptionalSelection;
  voices: OptionalSelection;
  formGroups: OptionalSelection;
};

export function selectionIncludes(selection: OptionalSelection, value: string) {
  return selection === null || selection.has(value);
}

export function vocabularyFamily(partOfSpeech: string) {
  return partOfSpeech.split(":", 1)[0].trim() || "Other";
}

export function matchesVocabularyCard(card: StudyCard, partOfSpeech: OptionalSelection) {
  return selectionIncludes(partOfSpeech, String(card.metadata?.partOfSpeech ?? card.category ?? ""));
}

export function grammarFormGroups(card: StudyCard) {
  const multiple = card.metadata?.formGroups;
  if (Array.isArray(multiple)) return multiple.map(String).filter(Boolean);
  const single = String(card.metadata?.formGroup ?? "");
  return single ? [single] : [];
}

export function matchesGrammarCard(card: StudyCard, filters: GrammarCardFilters) {
  const section = card.category ?? "";
  if (!selectionIncludes(filters.sections, section)) return false;
  if (section !== "Verbs") return true;

  const subsection = String(card.metadata?.studySubsection ?? "");
  const voice = String(card.metadata?.voiceGroup ?? "");
  const formGroups = grammarFormGroups(card);

  if (filters.verbSubsections !== null && !filters.verbSubsections.has(subsection)) return false;
  if (filters.voices !== null && !filters.voices.has(voice)) return false;
  if (filters.formGroups !== null && !formGroups.some((group) => filters.formGroups?.has(group))) return false;
  return true;
}
