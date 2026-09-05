import type { HenleSourceCard } from "./henle-data";

const cases = ["Nominative", "Genitive", "Dative", "Accusative", "Ablative", "Vocative"];
const numbers = ["Singular", "Plural"];
const genders = ["Masculine", "Feminine", "Neuter"];
const people = ["First", "Second", "Third"];

type AnswerKind = "Stem" | "Ending" | null;
function answerKind(item: HenleSourceCard | undefined): AnswerKind {
  if (!item) return null;
  if (item.verb_form_group === "Stems" || item.tags.includes("stems")) return "Stem";
  if (item.verb_form_group === "Personal Endings" || item.tags.includes("endings")) return "Ending";
  return null;
}
const answer = (item: HenleSourceCard | undefined, revealed: boolean) => revealed
  ? <span className="revealed-form">{answerKind(item) ? <><strong>{answerKind(item)}:</strong> </> : null}{item?.answer || "—"}</span>
  : <span className="chart-blank" aria-label="blank answer" />;

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
  const heading = kinds.length === 1 ? kinds[0] : "Form";
  return <div className="chart-scroll"><table className="henle-chart"><thead><tr><th>Prompt</th><th>{heading}</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><th>{item.prompt}</th><td>{answer(item, revealed)}</td></tr>)}</tbody></table></div>;
}

export function HenleChartTable({ items, revealed }: { items: HenleSourceCard[]; revealed: boolean }) {
  const declension = items.every((item) => /^(Nominative|Genitive|Dative|Accusative|Ablative|Vocative) (Masculine|Feminine|Neuter) (Singular|Plural)$/.test(item.prompt));
  const caseNumber = items.every((item) => /^(Nominative|Genitive|Dative|Accusative|Ablative|Vocative) (Singular|Plural)$/.test(item.prompt));
  const person = items.every((item) => /^(First|Second|Third) Person (Singular|Plural)$/.test(item.prompt));
  const principal = items.every((item) => /^(First|Second|Third|Fourth) Conjugation — (.+)$/.test(item.prompt));
  if (declension) return <Declension {...{ items, revealed }} />;
  if (caseNumber) return <Matrix {...{ items, revealed }} kind="case" />;
  if (person) return <Matrix {...{ items, revealed }} kind="person" />;
  if (principal) return <PrincipalParts {...{ items, revealed }} />;
  return <Generic {...{ items, revealed }} />;
}
