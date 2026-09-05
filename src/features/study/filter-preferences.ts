import type { GrammarCardFilters, OptionalSelection } from "./latin-study-filters";

export type LatinMaterial = "vocabulary" | "grammar-forms" | "grammar-charts";
export type LatinFilterPreferences = {
  materials: Set<LatinMaterial>;
  vocabularyParts: OptionalSelection;
  formFilters: GrammarCardFilters;
  chartFilters: GrammarCardFilters;
};

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const GREEK_FILTER_KEY = "greeklatinstudy:greek-filters:v1";
const LATIN_FILTER_KEY = "greeklatinstudy:latin-filters:v1";
const LATIN_MATERIALS = new Set<LatinMaterial>(["vocabulary", "grammar-forms", "grammar-charts"]);

function availableStorage(storage?: StorageLike | null) {
  if (storage !== undefined) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function restoreOptionalSelection(value: unknown): OptionalSelection {
  if (value === null) return null;
  return new Set(stringArray(value));
}

function storeOptionalSelection(selection: OptionalSelection) {
  return selection === null ? null : [...selection];
}

function blankGrammarFilters(): GrammarCardFilters {
  return { sections: null, verbSubsections: null, voices: null, formGroups: null };
}

function restoreGrammarFilters(value: unknown): GrammarCardFilters {
  if (!value || typeof value !== "object") return blankGrammarFilters();
  const stored = value as Record<string, unknown>;
  return {
    sections: restoreOptionalSelection(stored.sections),
    verbSubsections: restoreOptionalSelection(stored.verbSubsections),
    voices: restoreOptionalSelection(stored.voices),
    formGroups: restoreOptionalSelection(stored.formGroups),
  };
}

function storeGrammarFilters(filters: GrammarCardFilters) {
  return {
    sections: storeOptionalSelection(filters.sections),
    verbSubsections: storeOptionalSelection(filters.verbSubsections),
    voices: storeOptionalSelection(filters.voices),
    formGroups: storeOptionalSelection(filters.formGroups),
  };
}

export function loadGreekFilterSelection(defaultKeys: readonly string[], storage?: StorageLike | null) {
  const target = availableStorage(storage);
  if (!target) return new Set(defaultKeys);
  try {
    const raw = target.getItem(GREEK_FILTER_KEY);
    if (raw === null) return new Set(defaultKeys);
    const allowed = new Set(defaultKeys);
    return new Set(stringArray(JSON.parse(raw)).filter((key) => allowed.has(key)));
  } catch {
    return new Set(defaultKeys);
  }
}

export function saveGreekFilterSelection(selected: ReadonlySet<string>, storage?: StorageLike | null) {
  const target = availableStorage(storage);
  if (!target) return;
  target.setItem(GREEK_FILTER_KEY, JSON.stringify([...selected]));
}

export function loadLatinFilterPreferences(storage?: StorageLike | null): LatinFilterPreferences {
  const fallback = (): LatinFilterPreferences => ({
    materials: new Set<LatinMaterial>(["vocabulary"]),
    vocabularyParts: null,
    formFilters: blankGrammarFilters(),
    chartFilters: blankGrammarFilters(),
  });
  const target = availableStorage(storage);
  if (!target) return fallback();
  try {
    const raw = target.getItem(LATIN_FILTER_KEY);
    if (raw === null) return fallback();
    const stored = JSON.parse(raw) as Record<string, unknown>;
    const materials = new Set(
      stringArray(stored.materials).filter((value): value is LatinMaterial => LATIN_MATERIALS.has(value as LatinMaterial)),
    );
    return {
      materials,
      vocabularyParts: restoreOptionalSelection(stored.vocabularyParts),
      formFilters: restoreGrammarFilters(stored.formFilters),
      chartFilters: restoreGrammarFilters(stored.chartFilters),
    };
  } catch {
    return fallback();
  }
}

export function saveLatinFilterPreferences(preferences: LatinFilterPreferences, storage?: StorageLike | null) {
  const target = availableStorage(storage);
  if (!target) return;
  target.setItem(LATIN_FILTER_KEY, JSON.stringify({
    materials: [...preferences.materials],
    vocabularyParts: storeOptionalSelection(preferences.vocabularyParts),
    formFilters: storeGrammarFilters(preferences.formFilters),
    chartFilters: storeGrammarFilters(preferences.chartFilters),
  }));
}
