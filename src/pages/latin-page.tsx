import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { loadLatinDeck } from "../data/builtin-decks";
import { useAuth } from "../features/auth/auth-context";
import { HenleChartTable } from "../features/henle/henle-chart";
import { loadHenle, type HenleChart } from "../features/henle/henle-data";
import { HENLE_PART1_SECTIONS, matchesGrammarCard, matchesVocabularyCard, vocabularyFamily, type GrammarCardFilters, type OptionalSelection } from "../features/study/latin-study-filters";
import { MultiSourceStudySession, type StudySourceDefinition } from "../features/study/multi-source-study-session";
import { FilterCheckbox, FilterDisclosure, FilterSection, StudyFilterMenu } from "../features/study/study-filter-menu";
import type { DeckDefinition, StudyCard, StudyDirection } from "../features/study/types";
import { useAsync } from "../hooks/use-async";

type Material = "vocabulary" | "grammar-forms" | "grammar-charts";
type GrammarSelections = GrammarCardFilters;

const verbVoices = ["Active Voice", "Passive Voice", "Deponent", "Semi-Deponent"] as const;
const verbSubsections = ["Verb Foundations & Principal Parts", "Regular Verbs — Active Voice", "Regular Verbs — Passive Voice", "Third Conjugation -iō — Active Voice", "Third Conjugation -iō — Passive Voice", "Deponent Verbs", "Semi-Deponent Verbs", "Irregular Verbs", "Defective Verbs", "Participles — Declension"] as const;
const verbFormGroups = ["Indicative", "Subjunctive", "Imperative", "Infinitive", "Participle", "Gerund", "Gerundive", "Supine", "Principal Parts", "Personal Endings", "Stems"] as const;

function blankGrammarSelections(): GrammarSelections { return { sections: null, verbSubsections: null, voices: null, formGroups: null }; }
function emptyGrammarSelections(): GrammarSelections { return { sections: new Set(), verbSubsections: null, voices: null, formGroups: null }; }

function setValues(current: OptionalSelection, allValues: readonly string[], values: readonly string[], checked: boolean): OptionalSelection {
  const next = current === null ? new Set(allValues) : new Set(current);
  for (const value of values) checked ? next.add(value) : next.delete(value);
  return next.size === allValues.length ? null : next;
}
function selected(selection: OptionalSelection, value: string) { return selection === null || selection.has(value); }
function selectionKey(selection: OptionalSelection) { return selection === null ? "*" : [...selection].sort().join(","); }
function grammarSelectionKey(filters: GrammarSelections) { return [selectionKey(filters.sections), selectionKey(filters.voices), selectionKey(filters.formGroups), selectionKey(filters.verbSubsections)].join("~"); }
function grammarFiltersAreAll(filters: GrammarSelections) { return filters.sections === null && filters.voices === null && filters.formGroups === null && filters.verbSubsections === null; }
function selectionState(selection: OptionalSelection, allValues: readonly string[], active = true) {
  if (!active) return { checked: false, mixed: false, selectedCount: 0 };
  const selectedCount = selection === null ? allValues.length : allValues.filter((value) => selection.has(value)).length;
  return { checked: selectedCount === allValues.length, mixed: selectedCount > 0 && selectedCount < allValues.length, selectedCount };
}
function grammarHasAny(filters: GrammarSelections) { return filters.sections === null || filters.sections.size > 0; }

function sectionCounts(cards: readonly StudyCard[]) {
  const counts = new Map<string, number>(HENLE_PART1_SECTIONS.map((section) => [section, 0]));
  for (const card of cards) if (counts.has(card.category ?? "")) counts.set(card.category ?? "", (counts.get(card.category ?? "") ?? 0) + 1);
  return counts;
}

function HenleSourceFilters({ cards, filters, setFilters, active, onActivate }: {
  cards: readonly StudyCard[];
  filters: GrammarSelections;
  setFilters: Dispatch<SetStateAction<GrammarSelections>>;
  active: boolean;
  onActivate: () => void;
}) {
  const counts = useMemo(() => sectionCounts(cards), [cards]);
  const allSections = HENLE_PART1_SECTIONS as readonly string[];
  const allVoices = verbVoices as readonly string[];
  const allFormGroups = verbFormGroups as readonly string[];
  const allSubsections = verbSubsections as readonly string[];
  const verbsIncluded = active && selected(filters.sections, "Verbs");
  const voiceState = selectionState(filters.voices, allVoices, verbsIncluded);
  const formState = selectionState(filters.formGroups, allFormGroups, verbsIncluded);
  const familyState = selectionState(filters.verbSubsections, allSubsections, verbsIncluded);

  function activateOnly(key: keyof GrammarSelections, values: readonly string[]) {
    const next = emptyGrammarSelections();
    next.sections = key === "sections" ? new Set(values) : new Set(["Verbs"]);
    if (key !== "sections") next[key] = new Set(values);
    onActivate();
    setFilters(next);
  }

  function addVerbSubset(key: "voices" | "formGroups" | "verbSubsections", values: readonly string[]) {
    if (!active) { activateOnly(key, values); return; }
    setFilters((current) => ({ ...current, sections: setValues(current.sections, allSections, ["Verbs"], true), [key]: new Set(values) }));
  }

  function selectAllVerbDimension(key: "voices" | "formGroups" | "verbSubsections") {
    if (!active) onActivate();
    setFilters((current) => ({ ...current, sections: setValues(current.sections, allSections, ["Verbs"], true), [key]: null }));
  }

  function change(key: keyof GrammarSelections, allValues: readonly string[], values: readonly string[], checked: boolean) {
    if (!active && checked) { activateOnly(key, values); return; }
    if (key !== "sections" && !verbsIncluded && checked) { addVerbSubset(key, values); return; }
    setFilters((current) => ({ ...current, [key]: setValues(current[key], allValues, values, checked) }));
  }

  return <>
    {HENLE_PART1_SECTIONS.filter((section) => section !== "Verbs").map((section) => {
      const count = counts.get(section) ?? 0;
      return <FilterCheckbox key={section} label={section} count={count} checked={active && selected(filters.sections, section)} disabled={count === 0} onChange={(checked) => change("sections", allSections, [section], checked)} />;
    })}

    <FilterDisclosure
      title="Verbs"
      count={counts.get("Verbs") ?? 0}
      summary="Voice · mood/form · family"
      nested
      checked={verbsIncluded && filters.voices === null && filters.formGroups === null && filters.verbSubsections === null}
      mixed={verbsIncluded && (filters.voices !== null || filters.formGroups !== null || filters.verbSubsections !== null)}
      onCheckedChange={(checked) => {
        if (!active && checked) { onActivate(); setFilters({ ...blankGrammarSelections(), sections: new Set(["Verbs"]) }); return; }
        setFilters((current) => ({ ...current, sections: setValues(current.sections, allSections, ["Verbs"], checked), voices: null, formGroups: null, verbSubsections: null }));
      }}
    >
      <FilterDisclosure title="Voice" summary={`${voiceState.selectedCount} of ${allVoices.length} selected`} nested checked={voiceState.checked} mixed={voiceState.mixed} onCheckedChange={(checked) => {
        if (!verbsIncluded && checked) { selectAllVerbDimension("voices"); return; }
        setFilters((current) => ({ ...current, voices: checked ? null : new Set() }));
      }}>
        <FilterSection title="Voice" description="Choose one voice, several voices, or all of them.">
          {verbVoices.map((value) => <FilterCheckbox key={value} label={value} checked={verbsIncluded && selected(filters.voices, value)} onChange={(checked) => change("voices", allVoices, [value], checked)} />)}
        </FilterSection>
      </FilterDisclosure>

      <FilterDisclosure title="Mood / form" summary={`${formState.selectedCount} of ${allFormGroups.length} selected`} nested checked={formState.checked} mixed={formState.mixed} onCheckedChange={(checked) => {
        if (!verbsIncluded && checked) { selectAllVerbDimension("formGroups"); return; }
        setFilters((current) => ({ ...current, formGroups: checked ? null : new Set() }));
      }}>
        <FilterSection title="Mood / form" description="For example, choose Indicative alone or combine several forms.">
          {verbFormGroups.map((value) => <FilterCheckbox key={value} label={value} checked={verbsIncluded && selected(filters.formGroups, value)} onChange={(checked) => change("formGroups", allFormGroups, [value], checked)} />)}
        </FilterSection>
      </FilterDisclosure>

      <FilterDisclosure title="Verb family" summary={`${familyState.selectedCount} of ${allSubsections.length} selected`} nested checked={familyState.checked} mixed={familyState.mixed} onCheckedChange={(checked) => {
        if (!verbsIncluded && checked) { selectAllVerbDimension("verbSubsections"); return; }
        setFilters((current) => ({ ...current, verbSubsections: checked ? null : new Set() }));
      }}>
        <FilterSection title="Verb family" description="Optionally narrow by conjugation or special verb family.">
          {verbSubsections.map((value) => <FilterCheckbox key={value} label={value} checked={verbsIncluded && selected(filters.verbSubsections, value)} onChange={(checked) => change("verbSubsections", allSubsections, [value], checked)} />)}
        </FilterSection>
      </FilterDisclosure>
    </FilterDisclosure>
  </>;
}

export function LatinPage() {
  const { value: vocabularyDeck, error: vocabularyError } = useAsync(loadLatinDeck, []);
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [direction, setDirection] = useState<StudyDirection>("forward");
  const [materials, setMaterials] = useState<Set<Material>>(() => new Set(["vocabulary"]));
  const [grammarRequested, setGrammarRequested] = useState(false);
  const needsGrammar = grammarRequested || materials.has("grammar-forms") || materials.has("grammar-charts");
  const { value: henle, error: henleError, loading: henleLoading } = useAsync(async () => needsGrammar ? loadHenle() : null, [needsGrammar]);

  const [vocabularyParts, setVocabularyParts] = useState<OptionalSelection>(null);
  const [formFilters, setFormFilters] = useState<GrammarSelections>(blankGrammarSelections);
  const [chartFilters, setChartFilters] = useState<GrammarSelections>(blankGrammarSelections);
  const resumeSession = useMemo(() => {
    const id = searchParams.get("session"), startedAt = Number(searchParams.get("sessionStartedAt"));
    return id && Number.isFinite(startedAt) && startedAt > 0 ? { id, startedAt } : null;
  }, [searchParams]);

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
  const vocabularyActive = materials.has("vocabulary");
  const vocabularyState = selectionState(vocabularyParts, allVocabularyParts, vocabularyActive);

  const vocabularyCards = useMemo(() => vocabularyDeck?.cards.filter((card) => matchesVocabularyCard(card, vocabularyParts)) ?? [], [vocabularyDeck, vocabularyParts]);
  const grammarFormCards = useMemo(() => henle?.individualDeck.cards.filter((card) => matchesGrammarCard(card, formFilters)) ?? [], [formFilters, henle]);
  const grammarChartCards = useMemo(() => henle?.chartDeck.cards.filter((card) => matchesGrammarCard(card, chartFilters)) ?? [], [chartFilters, henle]);

  const sources = useMemo(() => {
    const next: StudySourceDefinition[] = [];
    if (materials.has("vocabulary") && vocabularyDeck) next.push({ id: "vocabulary", label: "Dickinson vocabulary", deck: vocabularyDeck, cards: vocabularyCards, studyKey: direction, direction });
    if (materials.has("grammar-forms") && henle) next.push({ id: "grammar-forms", label: "Henle grammar form", deck: henle.individualDeck, cards: grammarFormCards, studyKey: `individual:${direction}`, direction });
    if (materials.has("grammar-charts") && henle) next.push({ id: "grammar-charts", label: "Henle whole chart", deck: henle.chartDeck, cards: grammarChartCards, studyKey: "chart", direction: "forward" });
    return next;
  }, [direction, grammarChartCards, grammarFormCards, henle, materials, vocabularyCards, vocabularyDeck]);

  const selectedCards = useMemo(() => sources.flatMap((source) => source.cards), [sources]);
  const virtualDeck = useMemo<DeckDefinition>(() => ({ id: "latin-study-app", slug: "latin", title: "Latin", eyebrow: "Vocabulary · grammar", description: "A unified Latin study surface that can mix Dickinson vocabulary with Henle forms and whole charts while preserving each source's progress.", language: "latin", cards: selectedCards, supportsReverse: true }), [selectedCards]);
  const resetKey = `${direction}|${[...materials].sort().join(",")}|v:${selectionKey(vocabularyParts)}|f:${grammarSelectionKey(formFilters)}|c:${grammarSelectionKey(chartFilters)}`;
  const hasDirectionalCards = materials.has("vocabulary") || materials.has("grammar-forms");
  const formActive = materials.has("grammar-forms"), chartActive = materials.has("grammar-charts");
  const formAll = formActive && grammarFiltersAreAll(formFilters), chartAll = chartActive && grammarFiltersAreAll(chartFilters);

  function toggleMaterial(material: Material, checked: boolean) { setMaterials((current) => { const next = new Set(current); checked ? next.add(material) : next.delete(material); return next; }); }
  function activateVocabularyOnly(values: readonly string[]) { toggleMaterial("vocabulary", true); setVocabularyParts(new Set(values)); }
  function changeVocabulary(values: readonly string[], checked: boolean) {
    if (!vocabularyActive && checked) { activateVocabularyOnly(values); return; }
    setVocabularyParts((current) => setValues(current, allVocabularyParts, values, checked));
  }

  return <main className="page-shell study-page latin-page">
    <div className="study-page-heading">
      <div><p className="eyebrow">Vocabulary · forms · whole charts</p><h1>Latin</h1></div>
      <p>Open any source to choose individual children, whether or not its parent is selected. Parent checkboxes remain the fast way to select or clear everything below.</p>
    </div>
    {!user && <div className="guest-banner"><span>You are studying as a guest. Progress stays on this device.</span><Link to="/account">Sign in to sync</Link></div>}
    {(vocabularyError || henleError) && <div className="inline-alert">{vocabularyError ?? henleError}</div>}

    <StudyFilterMenu summary={`${selectedCards.length.toLocaleString()} cards in the current pool${henleLoading && needsGrammar ? " · loading grammar…" : ""}`} detail="Each source is a vertical accordion. Opening and selecting are independent; choosing a child never forces the whole parent on.">
      <FilterDisclosure title="Latin Vocabulary (Dickinson)" count={vocabularyDeck?.cards.length ?? 997} summary="Frequency-ranked · top 100, then 25-card unlocks" checked={vocabularyState.checked} mixed={vocabularyState.mixed} onCheckedChange={(checked) => { toggleMaterial("vocabulary", checked); setVocabularyParts(checked ? null : new Set()); }}>
        {vocabularyDeck && <FilterSection title="Vocabulary categories" description="Choose a category directly, or open a category with multiple subtypes for a narrower selection.">
          {[...vocabularyGroups.entries()].map(([family, items]) => {
            const values = items.map((item) => item.value), state = selectionState(vocabularyParts, values, vocabularyActive), count = items.reduce((sum, item) => sum + item.count, 0);
            if (items.length === 1) { const item = items[0]; return <FilterCheckbox key={family} label={family} count={count} checked={vocabularyActive && selected(vocabularyParts, item.value)} onChange={(checked) => changeVocabulary([item.value], checked)} />; }
            return <FilterDisclosure key={family} title={family} count={count} summary={`${state.selectedCount} of ${values.length} types selected`} checked={state.checked} mixed={state.mixed} onCheckedChange={(checked) => { if (!vocabularyActive && checked) { activateVocabularyOnly(values); return; } changeVocabulary(values, checked); }} nested>
              <FilterSection title={family} description={`Choose all ${family.toLowerCase()} vocabulary or only specific types.`}>
                {items.map((item) => <FilterCheckbox key={item.value} label={item.value.includes(":") ? item.value.split(":").slice(1).join(":").trim() : item.value} count={item.count} checked={vocabularyActive && selected(vocabularyParts, item.value)} onChange={(checked) => changeVocabulary([item.value], checked)} />)}
              </FilterSection>
            </FilterDisclosure>;
          })}
        </FilterSection>}
      </FilterDisclosure>

      <FilterDisclosure title="Henle Grammar Forms" count={2_062} summary="Individual Part 1 forms · Forward and Reverse" checked={formAll} mixed={formActive && !formAll && grammarHasAny(formFilters)} onOpenChange={(open) => { if (open) setGrammarRequested(true); }} onCheckedChange={(checked) => { toggleMaterial("grammar-forms", checked); setFormFilters(checked ? blankGrammarSelections() : emptyGrammarSelections()); }}>
        {henle ? <HenleSourceFilters cards={henle.individualDeck.cards} filters={formFilters} setFilters={setFormFilters} active={formActive} onActivate={() => toggleMaterial("grammar-forms", true)} /> : <div className="filter-disclosure-body">{henleLoading ? "Loading Henle grammar forms…" : "Open this section to load its child options."}</div>}
      </FilterDisclosure>

      <FilterDisclosure title="Henle Whole Charts" count={henle?.chartDeck.cards.length ?? 248} summary="Complete paradigms · independent chart mastery" checked={chartAll} mixed={chartActive && !chartAll && grammarHasAny(chartFilters)} onOpenChange={(open) => { if (open) setGrammarRequested(true); }} onCheckedChange={(checked) => { toggleMaterial("grammar-charts", checked); setChartFilters(checked ? blankGrammarSelections() : emptyGrammarSelections()); }}>
        {henle ? <HenleSourceFilters cards={henle.chartDeck.cards} filters={chartFilters} setFilters={setChartFilters} active={chartActive} onActivate={() => toggleMaterial("grammar-charts", true)} /> : <div className="filter-disclosure-body">{henleLoading ? "Loading Henle whole charts…" : "Open this section to load its child options."}</div>}
      </FilterDisclosure>
    </StudyFilterMenu>

    {vocabularyDeck ? <MultiSourceStudySession deck={virtualDeck} sources={sources} resetKey={resetKey} direction={direction} onDirectionChange={hasDirectionalCards ? setDirection : undefined} directionLabels={{ forward: "Forward", reverse: "Reverse" }} resumeSession={resumeSession} cardMeta={(card, source) => source.id === "vocabulary" ? `Entry ${Number(card.metadata?.deckPosition ?? 0)} of ${vocabularyDeck.cards.length} · Dickinson rank ${card.rank}` : `Rule ${card.rank}`} priorityPrompt={(card, copy) => String(card.metadata?.studySource) === "grammar-chart" ? `${card.front} · Complete chart` : copy.prompt} renderFront={(card, copy, source) => {
      if (source.id === "grammar-charts") { const chart = card.metadata?.chart as HenleChart; return <span className="henle-chart-face"><strong className="henle-card-title">{chart.title}</strong><span className="chart-instruction">Reconstruct the complete chart from memory.</span><HenleChartTable items={chart.items} revealed={false} /></span>; }
      if (source.id === "grammar-forms") return source.direction === "forward" ? <span className="henle-card-copy"><strong className="henle-card-title">{String(card.metadata?.title ?? "")}</strong><span className="henle-prompt">{String(card.metadata?.prompt ?? copy.prompt)}</span></span> : <span className="henle-prompt henle-form-prompt">{copy.prompt}</span>;
      return <span className={direction === "forward" ? "latin-front" : "study-prompt reverse-text-prompt"}>{copy.prompt}</span>;
    }} renderBack={(card, copy, source) => {
      if (source.id === "grammar-charts") { const chart = card.metadata?.chart as HenleChart; return <span className="henle-chart-face"><strong className="henle-card-title">{chart.title}</strong><HenleChartTable items={chart.items} revealed /></span>; }
      if (source.id === "grammar-forms") return <span className="answer-block henle-answer-block"><strong className="henle-answer">{copy.answer}</strong><span className="answer-notes">Rule {card.rank}</span></span>;
      return <span className="answer-block"><strong className={direction === "reverse" ? "latin-front compact-latin" : "study-answer"}>{copy.answer}</strong>{card.notes && <span className="answer-notes">{card.notes}</span>}</span>;
    }} /> : <div className="study-loading panel-surface"><span className="loading-mark">A</span><p>Preparing Latin…</p></div>}
  </main>;
}
