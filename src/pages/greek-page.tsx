import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadGreekDeck } from "../data/builtin-decks";
import { useAuth } from "../features/auth/auth-context";
import { FilterCheckbox, FilterDisclosure, FilterSection, StudyFilterMenu } from "../features/study/study-filter-menu";
import { StudySession } from "../features/study/study-session";
import type { StudyDirection } from "../features/study/types";
import { useAsync } from "../hooks/use-async";

const categories = {
  uppercase: "Alphabet — uppercase",
  lowercase: "Alphabet — lowercase",
  punctuation: "Punctuation",
  accents: "Accent marks",
} as const;
const allCategories = Object.values(categories);
const lesson1Categories = [categories.uppercase, categories.lowercase, categories.punctuation] as const;
const alphabetCategories = [categories.uppercase, categories.lowercase] as const;
const lesson2Categories = [categories.accents] as const;

function updateSet(current: Set<string>, values: readonly string[], checked: boolean) {
  const next = new Set(current);
  for (const value of values) checked ? next.add(value) : next.delete(value);
  return next;
}

function countSelected(selected: Set<string>, values: readonly string[]) {
  return values.filter((value) => selected.has(value)).length;
}

export function GreekPage() {
  const { value: deck, error } = useAsync(loadGreekDeck, []);
  const { user } = useAuth();
  const [direction, setDirection] = useState<StudyDirection>("forward");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(allCategories));
  const cards = useMemo(() => deck?.cards.filter((card) => selected.has(card.category ?? "")) ?? [], [deck, selected]);
  const countFor = (category: string) => deck?.cards.filter((card) => card.category === category).length ?? 0;
  const selectionKey = [...selected].sort().join("|");
  const lesson1Selected = countSelected(selected, lesson1Categories);
  const lesson2Selected = countSelected(selected, lesson2Categories);
  const alphabetSelected = countSelected(selected, alphabetCategories);

  return <main className="page-shell study-page">
    <div className="study-page-heading">
      <div><p className="eyebrow">Lessons 1–2 · alphabet · punctuation · accents</p><h1>Greek</h1></div>
      <p>Build a session by lesson. Lesson 1 contains the alphabet and punctuation; Lesson 2 contains the accent marks. Within the alphabet, uppercase and lowercase can be selected separately or together.</p>
    </div>
    {!user && <div className="guest-banner"><span>You are studying as a guest. Progress stays on this device.</span><Link to="/account">Sign in to sync</Link></div>}
    {error && <div className="inline-alert">{error}</div>}
    {deck && <StudyFilterMenu summary={`${cards.length} of ${deck.cards.length} cards selected`} detail="Lesson selections combine into one Greek study session. Open only the lesson or subsection you want to customize.">
      <FilterDisclosure title="Lesson 1" summary={`${lesson1Selected} of ${lesson1Categories.length} card types selected`}>
        <FilterSection title="Lesson 1 material" description="Choose alphabet, punctuation, or both." onAll={() => setSelected((current) => updateSet(current, lesson1Categories, true))} onNone={() => setSelected((current) => updateSet(current, lesson1Categories, false))}>
          <FilterCheckbox label="Punctuation" count={countFor(categories.punctuation)} checked={selected.has(categories.punctuation)} onChange={(checked) => setSelected((current) => updateSet(current, [categories.punctuation], checked))} hint="Lesson 1 punctuation marks" />
          <FilterDisclosure title="Alphabet" summary={`${alphabetSelected} of ${alphabetCategories.length} cases selected`} nested>
            <FilterSection title="Alphabet" description="Uppercase and lowercase are separate cards; select either or both." onAll={() => setSelected((current) => updateSet(current, alphabetCategories, true))} onNone={() => setSelected((current) => updateSet(current, alphabetCategories, false))}>
              <FilterCheckbox label="Uppercase letters" count={countFor(categories.uppercase)} checked={selected.has(categories.uppercase)} onChange={(checked) => setSelected((current) => updateSet(current, [categories.uppercase], checked))} />
              <FilterCheckbox label="Lowercase letters" count={countFor(categories.lowercase)} checked={selected.has(categories.lowercase)} onChange={(checked) => setSelected((current) => updateSet(current, [categories.lowercase], checked))} />
            </FilterSection>
          </FilterDisclosure>
        </FilterSection>
      </FilterDisclosure>

      <FilterDisclosure title="Lesson 2" summary={`${lesson2Selected} of ${lesson2Categories.length} card types selected`}>
        <FilterSection title="Lesson 2 material" description="Accent marks from Lesson 2." onAll={() => setSelected((current) => updateSet(current, lesson2Categories, true))} onNone={() => setSelected((current) => updateSet(current, lesson2Categories, false))}>
          <FilterCheckbox label="Accent marks" count={countFor(categories.accents)} checked={selected.has(categories.accents)} onChange={(checked) => setSelected((current) => updateSet(current, [categories.accents], checked))} />
        </FilterSection>
      </FilterDisclosure>
    </StudyFilterMenu>}
    {deck ? <StudySession key={`${direction}:${selectionKey}`} deck={deck} cards={cards} studyKey={direction} direction={direction} onDirectionChange={setDirection} directionLabels={{ forward: "Symbol → Name", reverse: "Name → Symbol" }} cardMeta={(card) => `Card ${card.rank ?? 0} of ${deck.cards.length}`} renderFront={(_card, copy) => <span className={direction === "forward" ? "greek-front" : "study-prompt reverse-text-prompt"}>{copy.prompt}</span>} renderBack={(card) => { const details = direction === "forward" ? card.back.split("\n").slice(1).join("\n") : card.reverseBack?.split("\n").slice(1).join("\n"); return <span className="answer-block"><strong className={direction === "reverse" ? "greek-front compact-greek" : "greek-answer-title"}>{direction === "reverse" ? card.front : String(card.metadata?.backTitle ?? "Answer")}</strong><span className="answer-notes">{details}</span></span>; }} /> : <div className="study-loading panel-surface"><span className="loading-mark">α</span><p>Preparing Greek…</p></div>}
  </main>;
}
