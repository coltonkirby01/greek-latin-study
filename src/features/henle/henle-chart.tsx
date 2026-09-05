import type { HenleSourceCard } from "./henle-data";

const cases = ["Nominative", "Genitive", "Dative", "Accusative", "Ablative", "Vocative"];
const numbers = ["Singular", "Plural"];
const genders = ["Masculine", "Feminine", "Neuter"];
const people = ["First", "Second", "Third"];

type AnswerKind = "Stem" | "Ending" | null;
type BadgeKind = "Stem" | "Stem / base" | "Ending" | "Complete form";
type PersonalParts = { base: string; ending: string };

function answerKind(item: HenleSourceCard | undefined): AnswerKind {
  if (!item) return null;
  const markers = `${item.verb_form_group ?? ""} ${item.tags.join(" ")} ${item.prompt}`.toLowerCase();
  if (markers.includes("stem")) return "Stem";
  if (markers.includes("ending")) return "Ending";
  return null;
}

function personalEndingParts(item: HenleSourceCard | undefined): PersonalParts | null {
  if (!item || item.answer.includes(" ") || item.answer.includes(",")) return null;
  if (/Indicative Perfect/i.test(item.title)) return null;
  const match = item.prompt.match(/^(First|Second|Third) Person (Singular|Plural)$/);
  if (!match) return null;
  const key = `${match[1]} ${match[2]}`;
  const passive = /Passive/i.test(item.verb_voice_group ?? "") || /Deponent/i.test(item.verb_voice_group ?? "") || /Passive/i.test(item.title);
  const endings: Record<string, string[]> = passive ? {
    "First Singular": ["or", "r"],
    "Second Singular": ["ris"],
    "Third Singular": ["tur"],
    "First Plural": ["mur"],
    "Second Plural": ["minī"],
    "Third Plural": ["ntur"],
  } : {
    "First Singular": ["ō", "m"],
    "Second Singular": ["s"],
    "Third Singular": ["t"],
    "First Plural": ["mus"],
    "Second Plural": ["tis"],
    "Third Plural": ["nt"],
  };
  const ending = (endings[key] ?? []).sort((a, b) => b.length - a.length).find((candidate) => item.answer.endsWith(candidate));
  if (!ending || item.answer.length <= ending.length) return null;
  return { base: item.answer.slice(0, -ending.length), ending };
}

const badgeStyle = (kind: BadgeKind) => ({
  display: "inline-flex",
  alignItems: "center",
  border: "1px solid var(--line)",
  borderRadius: "999px",
  padding: "0.16rem 0.42rem",
  fontSize: "0.68em",
  fontWeight: 800,
  letterSpacing: "0.065em",
  textTransform: "uppercase" as const,
  whiteSpace: "nowrap" as const,
  background: kind === "Complete form" ? "var(--surface)" : "var(--surface-raised, var(--surface))",
});

function componentBadge(kind: BadgeKind) {
  const className = kind.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
  return <span className={`henle-answer-kind ${className}`} style={badgeStyle(kind)}>{kind}</span>;
}

function answer(item: HenleSourceCard | undefined, revealed: boolean) {
  if (!revealed) return <span className="chart-blank" aria-label="blank answer" />;
  const kind = answerKind(item);
  const parts = !kind ? personalEndingParts(item) : null;
  if (parts && item) return <span className="revealed-form-components" style={{ display: "grid", gap: "0.3rem", textAlign: "left" }}>
    <span style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.38rem" }}>{componentBadge("Stem / base")}<strong>{parts.base}-</strong></span>
    <span style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.38rem" }}>{componentBadge("Ending")}<strong>-{parts.ending}</strong></span>
    <span style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.38rem" }}>{componentBadge("Complete form")}<strong>{item.answer}</strong></span>
  </span>;
  return <span className="revealed-form" style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: "0.42rem" }}>
    {componentBadge(kind ?? "Complete form")}
    <strong>{item?.answer || "—"}</strong>
  </span>;
}

function ComponentGuide({ items, revealed }: { items: HenleSourceCard[]; revealed: boolean }) {
  if (!revealed) return null;
  const stems = [...new Set(items.filter((item) => answerKind(item) === "Stem").map((item) => item.answer))];
  const endings = [...new Set(items.filter((item) => answerKind(item) === "Ending").map((item) => item.answer))];
  const splitForms = items.filter((item) => personalEndingParts(item));
  const hasExplicitComponents = stems.length > 0 || endings.length > 0;
  return <div className="henle-component-guide" style={{ display: "grid", gap: "0.45rem", margin: "0.2rem 0 0.8rem", padding: "0.7rem 0.8rem", border: "1px solid var(--line)", borderRadius: "8px", background: "var(--surface)" }}>
    <strong style={{ fontSize: "0.78rem", letterSpacing: "0.055em", textTransform: "uppercase" }}>How to read this answer</strong>
    {hasExplicitComponents && <>
      {stems.length > 0 && <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem" }}>{componentBadge("Stem")}<span><strong>Henle stem:</strong> {stems.join(", ")}</span></div>}
      {endings.length > 0 && <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem" }}>{componentBadge("Ending")}<span><strong>Henle ending:</strong> {endings.join(", ")}</span></div>}
    </>}
    {splitForms.length > 0 && <div style={{ display: "grid", gap: "0.35rem" }}>
      <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem" }}>{componentBadge("Stem / base")}<span>The material before the personal ending. It can contain the verb stem plus a tense or mood sign, and surface vowel changes can alter the visible stem.</span></div>
      <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem" }}>{componentBadge("Ending")}<span>The personal ending is separated from the form base.</span></div>
      <span style={{ fontSize: "0.84rem" }}>Each decomposable finite form below shows <strong>stem/form base + personal ending → complete form</strong>.</span>
    </div>}
    {!hasExplicitComponents && !splitForms.length && <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem" }}>{componentBadge("Complete form")}<span>This rule does not supply a defensible stem/personal-ending split in the Henle data, so the completed form is shown without inventing one.</span></div>}
  </div>;
}

function Declension({ items, revealed }: { items: HenleSourceCard[]; revealed: boolean }) {
  const parsed = items.map((item) => { const match = item.prompt.match(/^(Nominative|Genitive|Dative|Accusative|Ablative|Vocative) (Masculine|Feminine|Neuter) (Singular|Plural)$/); return match ? { item, case: match[1], gender: match[2], number: match[3] } : null; });
  if (parsed.some((item) => !item)) return null; const rows = parsed.filter(Boolean) as Array<{ item: HenleSourceCard; case: string; gender: string; number: string }>;
  return <>{numbers.filter((number) => rows.some((row) => row.number === number)).map((number) => { const subset = rows.filter((row) => row.number === number), presentGenders = genders.filter((gender) => subset.some((row) => row.gender === gender)); return <div className="chart-section" key={number}><h3>{number}</h3><div className="chart-scroll"><table className="henle-chart"><thead><tr><th>Case</th>{presentGenders.map((gender) => <th key={gender}>{gender}</th>)}</tr></thead><tbody>{cases.filter((name) => subset.some((row) => row.case === name)).map((name) => <tr key={name}><th>{name}</th>{presentGenders.map((gender) => <td key={gender}>{answer(subset.find((row) => row.case === name && row.gender === gender)?.item, revealed)}</td>)}</tr>)}</tbody></table></div></div>; })}</>;
}

function Matrix({ items, revealed, kind }: { items: HenleSourceCard[]; revealed: boolean; kind: "case" | "person" }) {
  const regex = kind === "case" ? /^(Nominative|Genitive|Dative|Accusative|Ablative|Vocative) (Singular|Plural)$/ : /^(First|Second|Third) Person (Singular|Plural)$/;
  const parsed = items.map((item) => { const match = item.prompt.match(regex); return match ? { item, row: match[1], number: match[2] } : null; }); if (parsed.some((item) => !item)) return null;
  const rows = parsed.filter(Boolean) as Array<{ item: HenleSourceCard; row: string; number: string }>, labels = (kind === "case" ? cases : people).filter((label) => rows.some((row) => row.row === label)), cols = numbers.filter((number) => rows.some((row) => row.number === number));
  if (new Set(rows.map((row) => `${row.row}|${row.number}`)).size !== rows.length) return null;
  return <div className="chart-scroll"><table className="henle-chart"><thead><tr><th>{kind === "case" ? "Case" : "Person"}</th>{cols.map((col) => <th key={col}>{col}</th>)}</tr></thead><tbody>{labels.map((label) => <tr key={label}><th>{label}</th>{cols.map((col) => <td key={col}>{answer(rows.find((row) => row.row === label && row.number === col)?.item, revealed)}</td>)}</tr>)}</tbody></table></div>;
}

function PrincipalParts({ items, revealed }: { items: HenleSourceCard[]; revealed: boolean }) {
  const parsed = items.map((item) => { const match = item.prompt.match(/^(First|Second|Third|Fourth) Conjugation — (.+)$/); return match ? { item, conjugation: match[1], part: match[2] } : null; }); if (parsed.some((item) => !item)) return null;
  const rows = parsed.filter(Boolean) as Array<{ item: HenleSourceCard; conjugation: string; part: string }>, conjugations = ["First", "Second", "Third", "Fourth"].filter((name) => rows.some((row) => row.conjugation === name)), parts = [...new Set(rows.map((row) => row.part))];
  return <div className="chart-scroll"><table className="henle-chart"><thead><tr><th>Conjugation</th>{parts.map((part) => <th key={part}>{part}</th>)}</tr></thead><tbody>{conjugations.map((conjugation) => <tr key={conjugation}><th>{conjugation}</th>{parts.map((part) => <td key={part}>{answer(rows.find((row) => row.conjugation === conjugation && row.part === part)?.item, revealed)}</td>)}</tr>)}</tbody></table></div>;
}

function Generic({ items, revealed }: { items: HenleSourceCard[]; revealed: boolean }) {
  const kinds = [...new Set(items.map(answerKind).filter(Boolean))] as Exclude<AnswerKind, null>[];
  const heading = kinds.length === 1 ? `${kinds[0]} answers` : kinds.length > 1 ? "Stem / Ending" : "Completed form";
  return <div className="chart-scroll"><table className="henle-chart"><thead><tr><th>Prompt</th><th>{heading}</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><th>{item.prompt}</th><td>{answer(item, revealed)}</td></tr>)}</tbody></table></div>;
}

export function HenleChartTable({ items, revealed }: { items: HenleSourceCard[]; revealed: boolean }) {
  const declension = items.every((item) => /^(Nominative|Genitive|Dative|Accusative|Ablative|Vocative) (Masculine|Feminine|Neuter) (Singular|Plural)$/.test(item.prompt));
  const caseNumber = items.every((item) => /^(Nominative|Genitive|Dative|Accusative|Ablative|Vocative) (Singular|Plural)$/.test(item.prompt));
  const person = items.every((item) => /^(First|Second|Third) Person (Singular|Plural)$/.test(item.prompt));
  const principal = items.every((item) => /^(First|Second|Third|Fourth) Conjugation — (.+)$/.test(item.prompt));
  const table = declension ? <Declension {...{ items, revealed }} /> : caseNumber ? <Matrix {...{ items, revealed }} kind="case" /> : person ? <Matrix {...{ items, revealed }} kind="person" /> : principal ? <PrincipalParts {...{ items, revealed }} /> : <Generic {...{ items, revealed }} />;
  return <><ComponentGuide {...{ items, revealed }} />{table}</>;
}