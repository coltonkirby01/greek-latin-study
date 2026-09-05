import { describe, expect, it } from "vitest";
import { loadGreekFilterSelection, loadLatinFilterPreferences, saveGreekFilterSelection, saveLatinFilterPreferences } from "../src/features/study/filter-preferences";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) { return values.get(key) ?? null; },
    setItem(key: string, value: string) { values.set(key, value); },
  };
}

describe("study filter preferences", () => {
  it("restores the last Greek filter selection, including an empty selection", () => {
    const storage = memoryStorage();
    saveGreekFilterSelection(new Set(["lesson1-uppercase", "lesson2-accents"]), storage);
    expect([...loadGreekFilterSelection(["lesson1-uppercase", "lesson1-lowercase", "lesson2-accents"], storage)].sort()).toEqual(["lesson1-uppercase", "lesson2-accents"]);

    saveGreekFilterSelection(new Set(), storage);
    expect([...loadGreekFilterSelection(["lesson1-uppercase"], storage)]).toEqual([]);
  });

  it("restores Latin materials and nested selections exactly", () => {
    const storage = memoryStorage();
    saveLatinFilterPreferences({
      materials: new Set(["grammar-forms", "grammar-charts"]),
      vocabularyParts: new Set(["Nouns", "Verbs"]),
      formFilters: { sections: new Set(["Verbs"]), verbSubsections: new Set(["Deponent Verbs"]), voices: new Set(["Deponent"]), formGroups: new Set(["Indicative", "Infinitive"]) },
      chartFilters: { sections: new Set(["Pronouns"]), verbSubsections: null, voices: null, formGroups: null },
    }, storage);

    const restored = loadLatinFilterPreferences(storage);
    expect([...restored.materials].sort()).toEqual(["grammar-charts", "grammar-forms"]);
    expect([...(restored.vocabularyParts ?? [])].sort()).toEqual(["Nouns", "Verbs"]);
    expect([...(restored.formFilters.sections ?? [])]).toEqual(["Verbs"]);
    expect([...(restored.formFilters.verbSubsections ?? [])]).toEqual(["Deponent Verbs"]);
    expect([...(restored.formFilters.voices ?? [])]).toEqual(["Deponent"]);
    expect([...(restored.formFilters.formGroups ?? [])].sort()).toEqual(["Indicative", "Infinitive"]);
    expect([...(restored.chartFilters.sections ?? [])]).toEqual(["Pronouns"]);
  });

  it("uses the original defaults when no stored preference exists", () => {
    const restored = loadLatinFilterPreferences(memoryStorage());
    expect([...restored.materials]).toEqual(["vocabulary"]);
    expect(restored.vocabularyParts).toBeNull();
    expect(restored.formFilters.sections).toBeNull();
    expect(restored.chartFilters.sections).toBeNull();
  });
});
