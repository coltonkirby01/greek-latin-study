import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadLatinDeck } from "../data/builtin-decks";
import { useAuth } from "../features/auth/auth-context";
import { HenleChartTable } from "../features/henle/henle-chart";
import { loadHenle, type HenleChart } from "../features/henle/henle-data";
import { matchesGrammarCard, matchesVocabularyCard, vocabularyFamily, type OptionalSelection } from "../features/study/latin-study-filters";
import { MultiSourceStudySession, type StudySourceDefinition } from "../features/study/multi-source-study-session";
import { FilterCheckbox, FilterSection, StudyFilterMenu } from "../features/study/study-filter-menu";
import type { DeckDefinition, StudyDirection } from "../features/study/types";
import { useAsync } from "../hooks/use-async";

type Material = "vocabulary" | "grammar-forms" | "grammar-charts";

const grammarSections = [["Nouns", 145], ["Adjectives", 349], ["Adverbs", 42], ["Numerals", 132], ["Pronouns", 240], ["Verbs", 1_154]] as const;
const verbVoices = [["Active Voice", 336], ["Passive Voice", 308], ["Deponent", 65], ["Semi-Deponent", 12]] as const;
const verbSubsections = [["Verb Foundations & Principal Parts", 52], ["Regular Verbs — Active Voice", 298], ["Regular Verbs — Passive Voice", 274], ["Third Conjugation -iō — Active Voice", 38], ["Third Conjugation -iō — Passive Voice", 34], ["Deponent Verbs", 65], ["Semi-Deponent Verbs", 12], ["Irregular Verbs", 355], ["Defective Verbs", 20], ["Participles — Declension", 6]] as const;
const verbFormGroups = [["Indicative", 513], ["Subjunctive", 342], ["Imperative", 38], ["Infinitive", 59], ["Participle", 56], ["Gerund", 45], ["Gerundive", 12], ["Supine", 18], ["Principal Parts", 16], ["Personal Endings", 12], ["Stems", 8]] as const;

function setValues(current: OptionalSelection, allValues: readonly string[], values: readonly string[], checked: boolean): OptionalSelection {
  const next = current === null ? new Set(allValues) : new Set(current);
  for (const value of values) checked ? next.add(value) : next.delete(value);
  return next.size === allValues.length ? null : next;
}
function selected(selection: OptionalSelection, value: string) { return selection === null || selection.has(value); }
function selectionKey(selection: OptionalSelection) { return selection === null ? "*" : [...selection].sort().join(","); }

export function LatinPage() {
  const { value: vocabularyDeck, error: vocabularyError } = useAsync(loadLatinDeck, []);
  const { user } = useAuth();
  const [direction, setDirection] = useState<StudyDirection>("forward");
  const [materials, setMaterials] = useState<Set<Material>>(() => new Set(["vocabulary"]));
  const needsGrammar = materials.has("grammar-forms") || materials.has("grammar-charts");
  const { value: henle, error: henleError, loading: henleLoading } = useAsync(async () => needsGrammar ? loadHenle() : null, [needsGrammar]);

  const [vocabularyParts, setVocabularyParts] = useState<OptionalSelection>(null);
  const [sections, setSections] = useState<OptionalSelection>(null);
  const [voices, setVoices] = useState<OptionalSelection>(null);
  const [subsections, setSubsections] = useState<OptionalSelection>(null);
  const [formGroups, setFormGroups] = useState<OptionalSelection>(null);

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

  const vocabularyCards = useMemo(() => vocabularyDeck?.cards.filter((card) => matchesVocabularyCard(card, vocabularyParts)) ?? [], [vocabularyDeck, vocabularyParts]);
  const grammarFilters = useMemo(() => ({ sections, verbSubsections: subsections, voices, formGroups }), [formGroups, sections, subsections, voices]);
  const grammarFormCards = useMemo(() => henle?.individualDeck.cards.filter((card) => matchesGrammarCard(card, grammarFilters)) ?? [], [grammarFilters, henle]);
  const grammarChartCards = useMemo(() => henle?.chartDeck.cards.filter((card) => matchesGrammarCard(card, grammarFilters)) ?? [], [grammarFilters, henle]);

  const sources = useMemo(() => {
    const next: StudySourceDefinition[] = [];
    if (materials.has("vocabulary") && vocabularyDeck) next.push({ id: "vocabulary", label: "Vocabulary", deck: vocabularyDeck, cards: vocabularyCards, studyKey: direction, direction });
    if (materials.has("grammar-forms") && henle) next.push({ id: "grammar-forms", label: "Grammar form", deck: henle.individualDeck, cards: grammarFormCards, studyKey: `individual:${direction}`, direction });
    if (materials.has("grammar-charts") && henle) next.push({ id: "grammar-charts", label: "Whole chart", deck: henle.chartDeck, cards: grammarChartCards, studyKey: "chart", direction: "forward" });
    return next;
  }, [direction, grammarChartCards, grammarFormCards, henle, materials, vocabularyCards, vocabularyDeck]);

  const selectedCards = useMemo(() => sources.flatMap((source) => source.cards), [sources]);
  const virtualDeck = useMemo<DeckDefinition>(() => ({ id: "latin-study-app", slug: "latin", title: "Latin", eyebrow: "Vocabulary · grammar", description: "A unified Latin study surface that can mix Dickinson vocabulary with Henle forms and whole charts while preserving each source's progress.", language: "latin", cards: selectedCards, supportsReverse: true }), [selectedCards]);
  const resetKey = `${direction}|${[...materials].sort().join(",")}|${selectionKey(vocabularyParts)}|${selectionKey(sections)}|${selectionKey(voices)}|${selectionKey(subsections)}|${selectionKey(formGroups)}`;
  const hasDirectionalCards = materials.has("vocabulary") || materials.has("grammar-forms");
  const allSections = grammarSections.map(([value]) => value), allVoices = verbVoices.map(([value]) => value), allSubsections = verbSubsections.map(([value]) => value), allFormGroups = verbFormGroups.map(([value]) => value);

  function toggleMaterial(material: Material, checked: boolean) { setMaterials((current) => { const next = new Set(current); checked ? next.add(material) : next.delete(material); return next; }); }

  return <main className="page-shell study-page latin-page">
    <div className="study-page-heading">
      <div><p className="eyebrow">Vocabulary · forms · whole charts</p><h1>Latin</h1></div>
      <p>Study vocabulary, grammar, or both together. Narrow the session by part of speech, grammar section, verb family, voice, and form or mood.</p>
    </div>
    {!user && <div className="guest-banner"><span>You are studying as a guest. Progress stays on this device.</span><Link to="/account">Sign in to sync</Link></div>}
    {(vocabularyError || henleError) && <div className="inline-alert">{vocabularyError ?? henleError}</div>}

    <StudyFilterMenu summary={`${selectedCards.length.toLocaleString()} cards in the current pool${henleLoading && needsGrammar ? " · loading grammar…" : ""}`} detail="Selections combine rather than replace one another. For example, choose Vocabulary + Grammar Forms to interleave them, or narrow Grammar to Verbs → Active Voice → Indicative.">
      <FilterSection title="Study material" description="Choose one or several sources. Grammar is fetched only when you select it, keeping vocabulary startup fast.">
        <FilterCheckbox label="Dickinson vocabulary" count={vocabularyDeck?.cards.length ?? 997} checked={materials.has("vocabulary")} onChange={(checked) => toggleMaterial("vocabulary", checked)} hint="Frequency-ranked; top 100 then 25-card unlocks" />
        <FilterCheckbox label="Henle grammar forms" count={2_062} checked={materials.has("grammar-forms")} onChange={(checked) => toggleMaterial("grammar-forms", checked)} hint="Individual forms from 331 rule groups" />
        <FilterCheckbox label="Henle whole charts" count={henle?.chartDeck.cards.length ?? 248} checked={materials.has("grammar-charts")} onChange={(checked) => toggleMaterial("grammar-charts", checked)} hint="Complete paradigms; always prompted forward" />
      </FilterSection>

      {materials.has("vocabulary") && vocabularyDeck && <FilterSection title="Vocabulary · parts of speech" description="Leave all selected for the full Dickinson core, or narrow to one or several families." onAll={() => setVocabularyParts(null)} onNone={() => setVocabularyParts(new Set())}>
        <div className="filter-subsection-stack">
          {[...vocabularyGroups.entries()].map(([family, items]) => <div key={family}>
            <div className="filter-subsection-heading"><span className="filter-subsection-label">{family}</span><div className="filter-actions"><button type="button" onClick={() => setVocabularyParts((current) => setValues(current, allVocabularyParts, items.map((item) => item.value), true))}>All</button><button type="button" onClick={() => setVocabularyParts((current) => setValues(current, allVocabularyParts, items.map((item) => item.value), false))}>None</button></div></div>
            <div className="filter-option-grid">{items.map((item) => <FilterCheckbox key={item.value} label={item.value.includes(":") ? item.value.split(":").slice(1).join(":").trim() : item.value} count={item.count} checked={selected(vocabularyParts, item.value)} onChange={(checked) => setVocabularyParts((current) => setValues(current, allVocabularyParts, [item.value], checked))} nested={items.length > 1} />)}</div>
          </div>)}
        </div>
      </FilterSection>}

      {needsGrammar && <>
        <FilterSection title="Grammar · sections" description="This is the broadest grammar level. Select all grammar, several sections, or just Verbs." onAll={() => setSections(null)} onNone={() => setSections(new Set())}>
          {grammarSections.map(([value, count]) => <FilterCheckbox key={value} label={value} count={count} checked={selected(sections, value)} onChange={(checked) => setSections((current) => setValues(current, allSections, [value], checked))} />)}
        </FilterSection>
        <FilterSection title="Verbs · voice" description="Applies only to verb cards. Leave All for every verb, or narrow to active, passive, deponent, or semi-deponent forms." onAll={() => setVoices(null)} onNone={() => setVoices(new Set())}>
          {verbVoices.map(([value, count]) => <FilterCheckbox key={value} label={value} count={count} checked={selected(voices, value)} onChange={(checked) => setVoices((current) => setValues(current, allVoices, [value], checked))} />)}
        </FilterSection>
        <FilterSection title="Verbs · mood / form" description="Selections intersect with Voice. For example, choosing Active Voice and Indicative produces active indicative verb cards." onAll={() => setFormGroups(null)} onNone={() => setFormGroups(new Set())}>
          {verbFormGroups.map(([value, count]) => <FilterCheckbox key={value} label={value} count={count} checked={selected(formGroups, value)} onChange={(checked) => setFormGroups((current) => setValues(current, allFormGroups, [value], checked))} />)}
        </FilterSection>
        <FilterSection title="Verbs · family" description="Optional additional narrowing by conjugation or special verb family." onAll={() => setSubsections(null)} onNone={() => setSubsections(new Set())}>
          {verbSubsections.map(([value, count]) => <FilterCheckbox key={value} label={value} count={count} checked={selected(subsections, value)} onChange={(checked) => setSubsections((current) => setValues(current, allSubsections, [value], checked))} />)}
        </FilterSection>
      </>}
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
