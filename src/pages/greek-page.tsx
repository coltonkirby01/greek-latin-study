import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadGreekDeck } from "../data/builtin-decks";
import { useAuth } from "../features/auth/auth-context";
import { FilterCheckbox, FilterSection, StudyFilterMenu } from "../features/study/study-filter-menu";
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

function updateSet(current: Set<string>, values: readonly string[], checked: boolean) {
  const next = new Set(current);
  for (const value of values) checked ? next.add(value) : next.delete(value);
  return next;
}

export function GreekPage() {
  const { value: deck, error } = useAsync(loadGreekDeck, []);
  const { user } = useAuth();
  const [direction, setDirection] = useState<StudyDirection>("forward");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(allCategories));
  const cards = useMemo(() => deck?.cards.filter((card) => selected.has(card.category ?? "")) ?? [], [deck, selected]);
  const countFor = (category: string) => deck?.cards.filter((card) => card.category === category).length ?? 0;

  return <main className="page-shell study-page">
    <div className="study-page-heading">
      <div><p className="eyebrow">Alphabet · punctuation · accents</p><h1>Greek</h1></div>
      <p>Choose one or several card types, then study them together with independent forward and reverse progress.</p>
    </div>
    {!user && <div className="guest-banner"><span>You are studying as a guest. Progress stays on this device.</span><Link to="/account">Sign in to sync</Link></div>}
    {error && <div className="inline-alert">{error}</div>}
    {deck && <StudyFilterMenu summary={`${cards.length} of ${deck.cards.length} cards selected`} detail="Selections combine into one Greek study session. Choose only uppercase, mix uppercase and lowercase, or include punctuation and accent marks at the same time.">
      <FilterSection title="Alphabet" description="Uppercase and lowercase are separate cards, so either or both can be included." onAll={() => setSelected((current) => updateSet(current, [categories.uppercase, categories.lowercase], true))} onNone={() => setSelected((current) => updateSet(current, [categories.uppercase, categories.lowercase], false))}>
        <FilterCheckbox label="Uppercase letters" count={countFor(categories.uppercase)} checked={selected.has(categories.uppercase)} onChange={(checked) => setSelected((current) => updateSet(current, [categories.uppercase], checked))} />
        <FilterCheckbox label="Lowercase letters" count={countFor(categories.lowercase)} checked={selected.has(categories.lowercase)} onChange={(checked) => setSelected((current) => updateSet(current, [categories.lowercase], checked))} />
      </FilterSection>
      <FilterSection title="Marks" description="Add either group to the same session as the alphabet." onAll={() => setSelected((current) => updateSet(current, [categories.punctuation, categories.accents], true))} onNone={() => setSelected((current) => updateSet(current, [categories.punctuation, categories.accents], false))}>
        <FilterCheckbox label="Punctuation" count={countFor(categories.punctuation)} checked={selected.has(categories.punctuation)} onChange={(checked) => setSelected((current) => updateSet(current, [categories.punctuation], checked))} />
        <FilterCheckbox label="Accent marks" count={countFor(categories.accents)} checked={selected.has(categories.accents)} onChange={(checked) => setSelected((current) => updateSet(current, [categories.accents], checked))} />
      </FilterSection>
    </StudyFilterMenu>}
    {deck ? <StudySession deck={deck} cards={cards} studyKey={direction} direction={direction} onDirectionChange={setDirection} directionLabels={{ forward: "Symbol → Name", reverse: "Name → Symbol" }} cardMeta={(card) => `Card ${card.rank ?? 0} of ${deck.cards.length}`} renderFront={(_card, copy) => <span className={direction === "forward" ? "greek-front" : "study-prompt reverse-text-prompt"}>{copy.prompt}</span>} renderBack={(card) => { const details = direction === "forward" ? card.back.split("\n").slice(1).join("\n") : card.reverseBack?.split("\n").slice(1).join("\n"); return <span className="answer-block"><strong className={direction === "reverse" ? "greek-front compact-greek" : "greek-answer-title"}>{direction === "reverse" ? card.front : String(card.metadata?.backTitle ?? "Answer")}</strong><span className="answer-notes">{details}</span></span>; }} /> : <div className="study-loading panel-surface"><span className="loading-mark">α</span><p>Preparing Greek…</p></div>}
  </main>;
}
