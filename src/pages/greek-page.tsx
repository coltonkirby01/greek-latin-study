import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { loadGreekDeck, loadGreekLesson3GrammarDeck, loadGreekLesson3VocabularyDeck } from "../data/builtin-decks";
import { useAuth } from "../features/auth/auth-context";
import { MultiSourceStudySession, type StudySourceDefinition } from "../features/study/multi-source-study-session";
import { FilterCheckbox, FilterDisclosure, FilterSection, StudyFilterMenu } from "../features/study/study-filter-menu";
import type { DeckDefinition, StudyDirection } from "../features/study/types";
import { useAsync } from "../hooks/use-async";

const categories = {
  uppercase: "Alphabet — uppercase",
  lowercase: "Alphabet — lowercase",
  punctuation: "Punctuation",
  accents: "Accent marks",
} as const;

const keys = {
  uppercase: "lesson1-uppercase",
  lowercase: "lesson1-lowercase",
  punctuation: "lesson1-punctuation",
  accents: "lesson2-accents",
  lesson3Vocabulary: "lesson3-vocabulary",
  presentActiveIndicative: "lesson3-present-active-indicative",
  presentActiveInfinitive: "lesson3-present-active-infinitive",
  presentActiveImperative: "lesson3-present-active-imperative",
} as const;

const allKeys = Object.values(keys);
const lesson1Keys = [keys.uppercase, keys.lowercase, keys.punctuation] as const;
const alphabetKeys = [keys.uppercase, keys.lowercase] as const;
const lesson2Keys = [keys.accents] as const;
const lesson3GrammarKeys = [keys.presentActiveIndicative, keys.presentActiveInfinitive, keys.presentActiveImperative] as const;
const lesson3Keys = [keys.lesson3Vocabulary, ...lesson3GrammarKeys] as const;
const allVocabularyKeys = [keys.lesson3Vocabulary] as const;
const allGrammarKeys = [...lesson1Keys, ...lesson2Keys, ...lesson3GrammarKeys] as const;

const grammarCategoryByKey = new Map<string, string>([
  [keys.presentActiveIndicative, "Present Active Indicative"],
  [keys.presentActiveInfinitive, "Present Active Infinitive"],
  [keys.presentActiveImperative, "Present Active Imperative"],
]);

function updateSet(current: Set<string>, values: readonly string[], checked: boolean) {
  const next = new Set(current);
  for (const value of values) checked ? next.add(value) : next.delete(value);
  return next;
}

function groupState(selected: Set<string>, values: readonly string[]) {
  const selectedCount = values.filter((value) => selected.has(value)).length;
  return { checked: selectedCount === values.length, mixed: selectedCount > 0 && selectedCount < values.length, selectedCount };
}

export function GreekPage() {
  const { value: decks, error } = useAsync(async () => {
    const [foundation, lesson3Vocabulary, lesson3Grammar] = await Promise.all([
      loadGreekDeck(),
      loadGreekLesson3VocabularyDeck(),
      loadGreekLesson3GrammarDeck(),
    ]);
    return { foundation, lesson3Vocabulary, lesson3Grammar };
  }, []);
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [direction, setDirection] = useState<StudyDirection>("forward");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(allKeys));
  const resumeSession = useMemo(() => {
    const id = searchParams.get("session"), startedAt = Number(searchParams.get("sessionStartedAt"));
    return id && Number.isFinite(startedAt) && startedAt > 0 ? { id, startedAt } : null;
  }, [searchParams]);

  const lesson1State = groupState(selected, lesson1Keys);
  const alphabetState = groupState(selected, alphabetKeys);
  const lesson2State = groupState(selected, lesson2Keys);
  const lesson3State = groupState(selected, lesson3Keys);
  const lesson3GrammarState = groupState(selected, lesson3GrammarKeys);
  const vocabularyState = groupState(selected, allVocabularyKeys);
  const grammarState = groupState(selected, allGrammarKeys);

  const foundationCards = useMemo(() => decks?.foundation.cards.filter((card) => {
    if (card.category === categories.uppercase) return selected.has(keys.uppercase);
    if (card.category === categories.lowercase) return selected.has(keys.lowercase);
    if (card.category === categories.punctuation) return selected.has(keys.punctuation);
    if (card.category === categories.accents) return selected.has(keys.accents);
    return false;
  }) ?? [], [decks, selected]);

  const lesson3VocabularyCards = useMemo(() => selected.has(keys.lesson3Vocabulary) ? decks?.lesson3Vocabulary.cards ?? [] : [], [decks, selected]);
  const lesson3GrammarCards = useMemo(() => decks?.lesson3Grammar.cards.filter((card) => {
    for (const [key, category] of grammarCategoryByKey) if (card.category === category) return selected.has(key);
    return false;
  }) ?? [], [decks, selected]);

  const sources = useMemo(() => {
    if (!decks) return [];
    const next: StudySourceDefinition[] = [];
    if (foundationCards.length) next.push({ id: "lessons-1-2", label: "Lessons 1–2 grammar", deck: decks.foundation, cards: foundationCards, studyKey: direction, direction });
    if (lesson3VocabularyCards.length) next.push({ id: "lesson3-vocabulary", label: "Lesson 3 vocabulary", deck: decks.lesson3Vocabulary, cards: lesson3VocabularyCards, studyKey: direction, direction });
    if (lesson3GrammarCards.length) next.push({ id: "lesson3-grammar", label: "Lesson 3 grammar", deck: decks.lesson3Grammar, cards: lesson3GrammarCards, studyKey: direction, direction });
    return next;
  }, [decks, direction, foundationCards, lesson3GrammarCards, lesson3VocabularyCards]);

  const selectedCards = useMemo(() => sources.flatMap((source) => source.cards), [sources]);
  const virtualDeck = useMemo<DeckDefinition>(() => ({
    id: "greek-study-app",
    slug: "greek",
    title: "Greek",
    eyebrow: "Grammar · vocabulary",
    description: "One Greek study app combining selected lesson material while preserving each source's progress.",
    language: "greek",
    cards: selectedCards,
    supportsReverse: true,
  }), [selectedCards]);
  const resetKey = `${direction}|${[...selected].sort().join("|")}`;

  const countFoundation = (category: string) => decks?.foundation.cards.filter((card) => card.category === category).length ?? 0;
  const countGrammar = (category: string) => decks?.lesson3Grammar.cards.filter((card) => card.category === category).length ?? 0;

  return <main className="page-shell study-page">
    <div className="study-page-heading">
      <div><p className="eyebrow">Grammar · vocabulary</p><h1>Greek</h1></div>
      <p>Select entire headings without opening them, or open any unchecked heading to choose individual children. Alphabet, punctuation, accents, and paradigms are grammar; Lesson 3 is the current vocabulary source.</p>
    </div>
    {!user && <div className="guest-banner"><span>You are studying as a guest. Progress stays on this device.</span><Link to="/account">Sign in to sync</Link></div>}
    {error && <div className="inline-alert">{error}</div>}

    {decks && <StudyFilterMenu summary={`${selectedCards.length} cards in the current pool`} detail="A parent checkbox is only a select-all shortcut. You can expand an unchecked heading and select any child independently; changing filters never erases stored progress.">
      <FilterSection title="Quick select" description="Vocabulary and grammar are classified by the course material, not by the visual form of the prompt.">
        <FilterCheckbox label="All Vocabulary" checked={vocabularyState.checked} mixed={vocabularyState.mixed} onChange={(checked) => setSelected((current) => updateSet(current, allVocabularyKeys, checked))} hint="Lesson 3 vocabulary" />
        <FilterCheckbox label="All Grammar" checked={grammarState.checked} mixed={grammarState.mixed} onChange={(checked) => setSelected((current) => updateSet(current, allGrammarKeys, checked))} hint="Lesson 1 alphabet + punctuation · Lesson 2 accents · Lesson 3 paradigms" />
      </FilterSection>

      <FilterDisclosure
        title="Lesson 1"
        summary={`Grammar · ${lesson1State.selectedCount} of ${lesson1Keys.length} groups selected`}
        checked={lesson1State.checked}
        mixed={lesson1State.mixed}
        onCheckedChange={(checked) => setSelected((current) => updateSet(current, lesson1Keys, checked))}
      >
        <FilterDisclosure
          title="Alphabet"
          summary={`${alphabetState.selectedCount} of ${alphabetKeys.length} cases selected`}
          count={countFoundation(categories.uppercase) + countFoundation(categories.lowercase)}
          nested
          checked={alphabetState.checked}
          mixed={alphabetState.mixed}
          onCheckedChange={(checked) => setSelected((current) => updateSet(current, alphabetKeys, checked))}
        >
          <FilterSection title="Letter case" description="Uppercase and lowercase remain separate grammar cards and can be combined.">
            <FilterCheckbox label="Uppercase" count={countFoundation(categories.uppercase)} checked={selected.has(keys.uppercase)} onChange={(checked) => setSelected((current) => updateSet(current, [keys.uppercase], checked))} />
            <FilterCheckbox label="Lowercase" count={countFoundation(categories.lowercase)} checked={selected.has(keys.lowercase)} onChange={(checked) => setSelected((current) => updateSet(current, [keys.lowercase], checked))} />
          </FilterSection>
        </FilterDisclosure>
        <FilterCheckbox label="Punctuation" count={countFoundation(categories.punctuation)} checked={selected.has(keys.punctuation)} onChange={(checked) => setSelected((current) => updateSet(current, [keys.punctuation], checked))} hint="Grammar" />
      </FilterDisclosure>

      <FilterDisclosure
        title="Lesson 2"
        summary="Grammar · accent marks"
        checked={lesson2State.checked}
        mixed={lesson2State.mixed}
        onCheckedChange={(checked) => setSelected((current) => updateSet(current, lesson2Keys, checked))}
      >
        <FilterCheckbox label="Accent marks" count={countFoundation(categories.accents)} checked={selected.has(keys.accents)} onChange={(checked) => setSelected((current) => updateSet(current, [keys.accents], checked))} hint="Grammar" />
      </FilterDisclosure>

      <FilterDisclosure
        title="Lesson 3"
        summary={`${lesson3State.selectedCount} of ${lesson3Keys.length} groups selected`}
        checked={lesson3State.checked}
        mixed={lesson3State.mixed}
        onCheckedChange={(checked) => setSelected((current) => updateSet(current, lesson3Keys, checked))}
      >
        <FilterDisclosure
          title="Vocabulary"
          summary="11 supplied Lesson 3 entries"
          count={decks.lesson3Vocabulary.cards.length}
          nested
          checked={selected.has(keys.lesson3Vocabulary)}
          onCheckedChange={(checked) => setSelected((current) => updateSet(current, [keys.lesson3Vocabulary], checked))}
        >
          <FilterSection title="Lesson 3 vocabulary" description="This source is tracked separately from grammar progress.">
            <FilterCheckbox label="All Lesson 3 vocabulary" count={decks.lesson3Vocabulary.cards.length} checked={selected.has(keys.lesson3Vocabulary)} onChange={(checked) => setSelected((current) => updateSet(current, [keys.lesson3Vocabulary], checked))} />
          </FilterSection>
        </FilterDisclosure>

        <FilterDisclosure
          title="Grammar"
          summary={`${lesson3GrammarState.selectedCount} of ${lesson3GrammarKeys.length} paradigms selected`}
          count={decks.lesson3Grammar.cards.length}
          nested
          checked={lesson3GrammarState.checked}
          mixed={lesson3GrammarState.mixed}
          onCheckedChange={(checked) => setSelected((current) => updateSet(current, lesson3GrammarKeys, checked))}
        >
          <FilterSection title="Lesson 3 grammar" description="Present active forms from the Lesson 3 paradigm of παιδεύω.">
            <FilterCheckbox label="Present Active Indicative" count={countGrammar("Present Active Indicative")} checked={selected.has(keys.presentActiveIndicative)} onChange={(checked) => setSelected((current) => updateSet(current, [keys.presentActiveIndicative], checked))} />
            <FilterCheckbox label="Present Active Infinitive" count={countGrammar("Present Active Infinitive")} checked={selected.has(keys.presentActiveInfinitive)} onChange={(checked) => setSelected((current) => updateSet(current, [keys.presentActiveInfinitive], checked))} />
            <FilterCheckbox label="Present Active Imperative" count={countGrammar("Present Active Imperative")} checked={selected.has(keys.presentActiveImperative)} onChange={(checked) => setSelected((current) => updateSet(current, [keys.presentActiveImperative], checked))} />
          </FilterSection>
        </FilterDisclosure>
      </FilterDisclosure>
    </StudyFilterMenu>}

    {decks ? <MultiSourceStudySession
      deck={virtualDeck}
      sources={sources}
      resetKey={resetKey}
      direction={direction}
      onDirectionChange={setDirection}
      directionLabels={{ forward: "Forward", reverse: "Reverse" }}
      resumeSession={resumeSession}
      cardMeta={(card, source) => source.id === "lessons-1-2" ? `Lessons ${Number(card.metadata?.lesson ?? 1)} · Card ${card.rank ?? 0}` : source.id === "lesson3-vocabulary" ? `Lesson 3 vocabulary · ${card.notes ?? ""}` : `Lesson 3 grammar · ${card.category ?? ""}`}
      renderFront={(card, copy, source) => {
        if (source.id === "lesson3-grammar") return source.direction === "forward" ? <span className="study-prompt reverse-text-prompt">{copy.prompt}</span> : <span className="greek-front">{copy.prompt}</span>;
        return <span className={source.direction === "forward" ? "greek-front" : "study-prompt reverse-text-prompt"}>{copy.prompt}</span>;
      }}
      renderBack={(card, copy, source) => {
        if (source.id === "lessons-1-2") {
          const details = source.direction === "forward" ? card.back.split("\n").slice(1).join("\n") : card.reverseBack?.split("\n").slice(1).join("\n");
          return <span className="answer-block"><strong className={source.direction === "reverse" ? "greek-front compact-greek" : "greek-answer-title"}>{source.direction === "reverse" ? card.front : String(card.metadata?.backTitle ?? "Answer")}</strong><span className="answer-notes">{details}</span></span>;
        }
        if (source.id === "lesson3-grammar") return <span className="answer-block"><strong className={source.direction === "forward" ? "greek-front compact-greek" : "study-answer"}>{copy.answer}</strong><span className="answer-notes">{String(card.metadata?.identification ?? "")} · ending {String(card.metadata?.ending ?? "")}</span></span>;
        return <span className="answer-block"><strong className={source.direction === "reverse" ? "greek-front compact-greek" : "study-answer"}>{copy.answer}</strong>{card.notes && <span className="answer-notes">{card.notes}</span>}</span>;
      }}
    /> : <div className="study-loading panel-surface"><span className="loading-mark">α</span><p>Preparing Greek…</p></div>}
  </main>;
}
