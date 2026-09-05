import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Link } from "react-router-dom";
import { loadLatinDeck } from "../data/builtin-decks";
import { useAuth } from "../features/auth/auth-context";
import { HenleChartTable } from "../features/henle/henle-chart";
import { loadHenle, type HenleChart } from "../features/henle/henle-data";
import { grammarFormGroups, HENLE_PART1_SECTIONS, matchesGrammarCard, matchesVocabularyCard, vocabularyFamily, type GrammarCardFilters, type OptionalSelection } from "../features/study/latin-study-filters";
import { MultiSourceStudySession, type StudySourceDefinition } from "../features/study/multi-source-study-session";
import { FilterCheckbox, FilterDisclosure, FilterSection, StudyFilterMenu } from "../features/study/study-filter-menu";
import type { DeckDefinition, StudyCard, StudyDirection } from "../features/study/types";
import { useAsync } from "../hooks/use-async";

type Material = "vocabulary" | "grammar-forms" | "grammar-charts";
type GrammarSelections = GrammarCardFilters;

const verbVoices = ["Active Voice", "Passive Voice", "Deponent", "Semi-Deponent"] as const;
const verbSubsections = ["Verb Foundations & Principal Parts", "Regular Verbs — Active Voice", "Regular Verbs — Passive Voice", "Third Conjugation -iō — Active Voice", "Third Conjugation -iō — Passive Voice", "Deponent Verbs", "Semi-Deponent Verbs", "Irregular Verbs", "Defective Verbs", "Participles — Declension"] as const;
const verbFormGroups = ["Indicative", "Subjunctive", "Imperative", "Infinitive", "Participle", "Gerund", "Gerundive", "Supine", "Principal Parts", "Personal Endings", "Stems"] as const;

function blankGrammarSelections(): GrammarSelections {
  return { sections: null, verbSubsections: null, voices: null, formGroups: null };
}

function setValues(current: OptionalSelection, allValues: readonly string[], values: readonly string[], checked: boolean): OptionalSelection {
  const next = current === null ? new Set(allValues) : new Set(current);
  for (const value of values) checked ? next.add(value) : next.delete(value);
  return next.size === allValues.length ? null : next;
}
function selected(selection: OptionalSelection, value: string) { return selection === null || selection.has(value); }
function selectionKey(selection: OptionalSelection) { return selection === null ? "*" : [...selection].sort().join(","); }
function grammarSelectionKey(filters: GrammarSelections) { return [selectionKey(filters.sections), selectionKey(filters.voices), selectionKey(filters.formGroups), selectionKey(filters.verbSubsections)].join("~"); }
function selectionState(selection: OptionalSelection, allValues: readonly string[]) {
  const selectedCount = selection === null ? allValues.length : allValues.filter((value) => selection.has(value)).length;
  return { checked: selectedCount === allValues.length, mixed: selectedCount > 0 && selectedCount < allValues.length, selectedCount };
}

function sectionCounts(cards: readonly StudyCard[]) {
  const counts = new Map<string, number>(HENLE_PART1_SECTIONS.map((section) => [section, 0]));
  for (const card of cards) {
    const section = card.category ?? "";
    if (counts.has(section)) counts.set(section, (counts.get(section) ?? 0) + 1);
  }
  return counts;
}

function HenleSourceFilters({ cards, filters, setFilters }: {
  cards: readonly StudyCard[];
  filters: GrammarSelections;
  setFilters: Dispatch<SetStateAction<GrammarSelections>>;
}) {
  const counts = useMemo(() => sectionCounts(cards), [cards]);
  const allSections = HENLE_PART1_SECTIONS as readonly string[];
  const allVoices = verbVoices as readonly string[];
  const allFormGroups = verbFormGroups as readonly string[];
  const allSubsections = verbSubsections as readonly string[];
  const sectionState = selectionState(filters.sections, allSections);
  const voiceState = selectionState(filters.voices, allVoices);
  const formState = selectionState(filters.formGroups, allFormGroups);
  const familyState = selectionState(filters.verbSubsections, allSubsections);
  const verbsIncluded = selected(filters.sections, "Verbs");

  function change(key: keyof GrammarSelections, allValues: readonly string[], values: readonly string[], checked: boolean) {
    setFilters((current) => ({ ...current, [key]: setValues(current[key], allValues, values, checked) }));
  }

  return <FilterDisclosure
    title="Part 1 sections"
    summary={`${sectionState.selectedCount} of ${allSections.length} selected`}
    checked={sectionState.checked}
    mixed={sectionState.mixed}
    onCheckedChange={(checked) => setFilters((current) => ({ ...current, sections: checked ? null : new Set() }))}
  >
    <FilterSection title="Parts of speech" description="Select every Part 1 section or narrow the source vertically.">
      {HENLE_PART1_SECTIONS.filter((section) => section !== "Verbs").map((section) => {
        const count = counts.get(section) ?? 0;
        return <FilterCheckbox key={section} label={section} count={count} checked={selected(filters.sections, section)} disabled={count === 0} onChange={(checked) => change("sections", allSections, [section], checked)} />;
      })}

      <FilterDisclosure
        title="Verbs"
        count={counts.get("Verbs") ?? 0}
        summary="Voice · mood/form · family"
        nested
        checked={selected(filters.sections, "Verbs")}
        onCheckedChange={(checked) => change("sections", allSections, ["Verbs"], checked)}
      >
        {verbsIncluded && <>
          <FilterDisclosure
            title="Voice"
            summary={`${voiceState.selectedCount} of ${allVoices.length} selected`}
            nested
            checked={voiceState.checked}
            mixed={voiceState.mixed}
            onCheckedChange={(checked) => setFilters((current) => ({ ...current, voices: checked ? null : new Set() }))}
          >
            <FilterSection title="Voice" description="Choose all voices or narrow to one or several.">
              {verbVoices.map((value) => <FilterCheckbox key={value} label={value} checked={selected(filters.voices, value)} onChange={(checked) => change("voices", allVoices, [value], checked)} />)}
            </FilterSection>
          </FilterDisclosure>

          <FilterDisclosure
            title="Mood / form"
            summary={`${formState.selectedCount} of ${allFormGroups.length} selected`}
            nested
            checked={formState.checked}
            mixed={formState.mixed}
            onCheckedChange={(checked) => setFilters((current) => ({ ...current, formGroups: checked ? null : new Set() }))}
          >
            <FilterSection title="Mood / form" description="For example, select Indicative alone or combine several forms.">
              {verbFormGroups.map((value) => <FilterCheckbox key={value} label={value} checked={selected(filters.formGroups, value)} onChange={(checked) => change("formGroups", allFormGroups, [value], checked)} />)}
            </FilterSection>
          </FilterDisclosure>

          <FilterDisclosure
            title="Verb family"
            summary={`${familyState.selectedCount} of ${allSubsections.length} selected`}
            nested
            checked={familyState.checked}
            mixed={familyState.mixed}
            onCheckedChange={(checked) => setFilters((current) => ({ ...current, verbSubsections: checked ? null : new Set() }))}
          >
            <FilterSection title="Verb family" description="Optionally narrow by conjugation or special verb family.">
              {verbSubsections.map((value) => <FilterCheckbox key={value} label={value} checked={selected(filters.verbSubsections, value)} onChange={(checked) => change("verbSubsections", allSubsections, [value], checked)} />)}
            </FilterSection>
          </FilterDisclosure>
        </>}
      </FilterDisclosure>
    </FilterSection>
  </FilterDisclosure>;
}

export function LatinPage() {
  const { value: vocabularyDeck, error: vocabularyError } = useAsync(loadLatinDeck, []);
  const { user } = useAuth();
  const [direction, setDirection] = useState<StudyDirection>("forward");
  const [materials, setMaterials] = useState<Set<Material>>(() => new Set(["vocabulary"]));
  const needsGrammar = materials.has("grammar-forms") || materials.has("grammar-charts");
  const { value: henle, error: henleError, loading: henleLoading } = useAsync(async () => needsGrammar ? loadHenle() : null, [needsGrammar]);

  const [vocabularyParts, setVocabularyParts] = useState<OptionalSelection>(null);
  const [formFilters, setFormFilters] = useState<GrammarSelections>(blankGrammarSelections);
  const [chartFilters, setChartFilters] = useState<GrammarSelections>(blankGrammarSelections);

  const vocabularyGroups = useMemo(() => {
    const groups = new Map<string, Array<{ value: string; count: number }>>();
    if (!vocabularyDeck) return groups;
    const counts = new Map<string, number>();
    for (const card of vocabularyDeck.cards) {
      const value = String(card.metadata?.partOfSpeech ?? card.category ?? "Vocabulary");
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    for (const [value, count] of [...counts.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const family = vocabularyFamily(value);
      groups.set(family, [...(groups.get(family) ?? []), { value, count }]);
    }
    return groups;
  }, [vocabularyDeck]);
  const allVocabularyParts = useMemo(() => [...vocabularyGroups.values()].flat().map((item) => item.value), [vocabularyGroups]);
  const vocabularyState = selectionState(vocabularyParts, allVocabularyParts);

  const vocabularyCards = useMemo(() => vocabularyDeck?.cards.filter((card) => matchesVocabularyCard(card, vocabularyParts)) ?? [], [vocabularyDeck, vocabularyParts]);
  const grammarFormCards = useMemo(() => henle?.individualDeck.cards.filter((card) => matchesGrammarCard(card, formFilters)) ?? [], [formFilters, henle]);
  const grammarChartCards = useMemo(() => henle?.chartDeck.cards.filter((card) => matchesGrammarCard(card, chartFilters)) ?? [], [chartFilters, henle]);

  const sources = useMemo(() => {
    const next: StudySourceDefinition[] = [];
    if (materials.has("vocabulary") && vocabularyDeck) next.push({ id: "vocabulary", label: "Vocabulary", deck: vocabularyDeck, cards: vocabularyCards, studyKey: direction, direction });
    if (materials.has("grammar-forms") && henle) next.push({ id: "grammar-forms", label: "Grammar form", deck: henle.individualDeck, cards: grammarFormCards, studyKey: `individual:${direction}`, direction });
    if (materials.has("grammar-charts") && henle) next.push({ id: "grammar-charts", label: "Whole chart", deck: henle.chartDeck, cards: grammarChartCards, studyKey: "chart", direction: "forward" });
    return next;
  }, [direction, grammarChartCards, grammarFormCards, henle, materials, vocabularyCards, vocabularyDeck]);

  const selectedCards = useMemo(() => sources.flatMap((source) => source.cards), [sources]);
  const virtualDeck = useMemo<DeckDefinition>(() => ({ id: "latin-study-app", slug: "latin", title: "Latin", eyebrow: "Vocabulary · grammar", description: "A unified Latin study surface that can mix Dickinson vocabulary with Henle forms and whole charts while preserving each source's progress.", language: "latin", cards: selectedCards, supportsReverse: true }), [selectedCards]);
  const resetKey = `${direction}|${[...materials].sort().join(",")}|vocab:${selectionKey(vocabularyParts)}|forms:${grammarSelectionKey(formFilters)}|charts:${grammarSelectionKey(chartFilters)}`;
  const hasDirectionalCards = materials.has("vocabulary") || materials.has("grammar-forms");

  function toggleMaterial(material: Material, checked: boolean) { setMaterials((current) => { const next = new Set(current); checked ? next.add(material) : next.delete(material); return next; }); }

  return <main className="page-shell study-page latin-page">
    <div className="study-page-heading">
      <div><p className="eyebrow">Vocabulary · forms · whole charts</p><h1>Latin</h1></div>
      <p>Choose whole sources with one click, or open their drop-downs to narrow them. Henle Part 1 includes nouns, adjectives, adverbs, numerals, pronouns, and verbs.</p>
    </div>
    {!user && <div className="guest-banner"><span>You are studying as a guest. Progress stays on this device.</span><Link to="/account">Sign in to sync</Link></div>}
    {(vocabularyError || henleError) && <div className="inline-alert">{vocabularyError ?? henleError}</div>}

    <StudyFilterMenu summary={`${selectedCards.length.toLocaleString()} cards in the current pool${henleLoading && needsGrammar ? " · loading grammar…" : ""}`} detail="Each source is a vertical drop-down. The checkbox on a heading selects or clears everything under that heading; open the chevron only when you want a narrower pool.">
      <FilterDisclosure
        title="Dickinson vocabulary"
        count={vocabularyDeck?.cards.length ?? 997}
        summary="Frequency-ranked · top 100, then 25-card unlocks"
        checked={materials.has("vocabulary")}
        onCheckedChange={(checked) => toggleMaterial("vocabulary", checked)}
      >
        {vocabularyDeck && <FilterDisclosure
          title="Parts of speech"
          summary={`${vocabularyState.selectedCount} of ${allVocabularyParts.length} selected`}
          checked={vocabularyState.checked}
          mixed={vocabularyState.mixed}
          onCheckedChange={(checked) => setVocabularyParts(checked ? null : new Set())}
          nested
        >
          <FilterSection title="Vocabulary categories" description="Select an entire part-of-speech family, or open a family to choose narrower types.">
            {[...vocabularyGroups.entries()].map(([family, items]) => {
              const values = items.map((item) => item.value);
              const state = selectionState(vocabularyParts, values);
              const count = items.reduce((sum, item) => sum + item.count, 0);
              if (items.length === 1) {
                const item = items[0];
                return <FilterCheckbox key={family} label={family} count={count} checked={selected(vocabularyParts, item.value)} onChange={(checked) => setVocabularyParts((current) => setValues(current, allVocabularyParts, [item.value], checked))} />;
              }
              return <FilterDisclosure
                key={family}
                title={family}
                count={count}
                summary={`${state.selectedCount} of ${values.length} types selected`}
                checked={state.checked}
                mixed={state.mixed}
                onCheckedChange={(checked) => setVocabularyParts((current) => setValues(current, allVocabularyParts, values, checked))}
                nested
              >
                <FilterSection title={family} description={`Choose all ${family.toLowerCase()} vocabulary or only specific types.`}>
                  {items.map((item) => <FilterCheckbox key={item.value} label={item.value.includes(":") ? item.value.split(":").slice(1).join(":").trim() : item.value} count={item.count} checked={selected(vocabularyParts, item.value)} onChange={(checked) => setVocabularyParts((current) => setValues(current, allVocabularyParts, [item.value], checked))} />)}
                </FilterSection>
              </FilterDisclosure>;
            })}
          </FilterSection>
        </FilterDisclosure>}
      </FilterDisclosure>

      <FilterDisclosure
        title="Henle grammar forms"
        count={2_062}
        summary="Individual Part 1 forms · Forward and Reverse"
        checked={materials.has("grammar-forms")}
        onCheckedChange={(checked) => toggleMaterial("grammar-forms", checked)}
      >
        {materials.has("grammar-forms") ? (henle ? <HenleSourceFilters cards={henle.individualDeck.cards} filters={formFilters} setFilters={setFormFilters} /> : <div className="filter-disclosure-body">Loading Henle grammar forms…</div>) : <p className="filter-menu-detail">Select Henle grammar forms to include this source, then open this menu to narrow it.</p>}
      </FilterDisclosure>

      <FilterDisclosure
        title="Henle whole charts"
        count={henle?.chartDeck.cards.length ?? 248}
        summary="Complete paradigms · independent chart mastery"
        checked={materials.has("grammar-charts")}
        onCheckedChange={(checked) => toggleMaterial("grammar-charts", checked)}
      >
        {materials.has("grammar-charts") ? (henle ? <HenleSourceFilters cards={henle.chartDeck.cards} filters={chartFilters} setFilters={setChartFilters} /> : <div className="filter-disclosure-body">Loading Henle whole charts…</div>) : <p className="filter-menu-detail">Select Henle whole charts to include this source, then open this menu to narrow it.</p>}
      </FilterDisclosure>
    </StudyFilterMenu>

    {vocabularyDeck ? <MultiSourceStudySession deck={virtualDeck} sources={sources} resetKey={resetKey} direction={direction} onDirectionChange={hasDirectionalCards ? setDirection : undefined} directionLabels={{ forward: "Forward", reverse: "Reverse" }} cardMeta={(card, source) => source.id === "vocabulary" ? `Entry ${Number(card.metadata?.deckPosition ?? 0)} of ${vocabularyDeck.cards.length} · Dickinson rank ${card.rank}` : `Rule ${card.rank}`} priorityPrompt={(card, copy) => String(card.metadata?.studySource) === "grammar-chart" ? `${card.front} · Complete chart` : copy.prompt} renderFront={(card, copy, source) => {
      if (source.id === "grammar-charts") {
        const chart = card.metadata?.chart as HenleChart;
        return <span className="henle-chart-face"><strong className="henle-card-title">{chart.title}</strong><span className="chart-instruction">Reconstruct the complete chart from memory.</span><HenleChartTable items={chart.items} revealed={false} /></span>;
      }
      if (source.id === "grammar-forms") return source.direction === "forward" ? <span className="henle-card-copy"><strong className="henle-card-title">{String(card.metadata?.title ?? "")}</strong><span className="henle-prompt">{String(card.metadata?.prompt ?? copy.prompt)}</span></span> : <span className="henle-prompt henle-form-prompt">{copy.prompt}</span>;
      return <span className={direction === "forward" ? "latin-front" : "study-prompt reverse-text-prompt"}>{copy.prompt}</span>;
    }} renderBack={(card, copy, source) => {
      if (source.id === "grammar-charts") {
        const chart = card.metadata?.chart as HenleChart;
        return <span className="henle-chart-face"><strong className="henle-card-title">{chart.title}</strong><HenleChartTable items={chart.items} revealed /></span>;
      }
      if (source.id === "grammar-forms") return <span className="answer-block henle-answer-block"><strong className="henle-answer">{copy.answer}</strong><span className="answer-notes">Rule {card.rank}</span></span>;
      return <span className="answer-block"><strong className={direction === "reverse" ? "latin-front compact-latin" : "study-answer"}>{copy.answer}</strong>{card.notes && <span className="answer-notes">{card.notes}</span>}</span>;
    }} /> : <div className="study-loading panel-surface"><span className="loading-mark">A</span><p>Preparing Latin…</p></div>}
  </main>;
}
