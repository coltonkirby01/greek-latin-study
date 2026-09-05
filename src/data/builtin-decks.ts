import type { DeckDefinition, StudyCard } from "../features/study/types";
import { classicalGreekPronunciation } from "../features/greek/greek-pronunciation";

type GreekSourceCard = { id: string; category: string; front: string; back_title: string; back: string };
type GreekLesson3VocabularySourceCard = { id: string; greek: string; meaning: string; part_of_speech: string; lesson: number };
type GreekLesson3GrammarSourceCard = { id: string; category: string; form: string; prompt: string; identification: string; ending: string };
type LatinSourceCard = { id: string; headword: string; definition: string; partOfSpeech: string; semanticGroup: string; frequencyRank: number; deckPosition: number };
const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
async function fetchText(path: string) { const response = await fetch(assetUrl(path), { cache: "force-cache" }); if (!response.ok) throw new Error(`Could not load ${path}.`); return response.text(); }

export function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) { const char = text[index]; if (quoted) { if (char === '"') { if (text[index + 1] === '"') { field += '"'; index += 1; } else quoted = false; } else field += char; } else if (char === '"') quoted = true; else if (char === ",") { row.push(field); field = ""; } else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; } else field += char; }
  if (field.length || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); } return rows;
}

export function latinRowsToCards(rows: string[][]): LatinSourceCard[] {
  if (!rows.length) return []; const headers = rows[0].map((header) => header.trim()), column = (name: string) => headers.indexOf(name);
  const headword = column("Headword"), definition = column("Definition"), partOfSpeech = column("Part of Speech"), semanticGroup = column("Semantic Group"), frequencyRank = column("Frequency Rank");
  if ([headword, definition, partOfSpeech, semanticGroup, frequencyRank].some((index) => index < 0)) throw new Error("The Dickinson vocabulary columns could not be read.");
  return rows.slice(1).map((row, originalIndex) => ({ headword: (row[headword] || "").trim(), definition: (row[definition] || "").trim().replace(/\s+/g, " "), partOfSpeech: (row[partOfSpeech] || "").trim(), semanticGroup: (row[semanticGroup] || "").trim(), frequencyRank: Number((row[frequencyRank] || "").trim()), originalIndex })).filter((card) => card.headword && Number.isFinite(card.frequencyRank)).sort((a, b) => a.frequencyRank - b.frequencyRank || a.originalIndex - b.originalIndex).slice(0, 1_000).map((card, index) => ({ id: `${index + 1}|${card.frequencyRank}|${card.headword}`, headword: card.headword, definition: card.definition, partOfSpeech: card.partOfSpeech, semanticGroup: card.semanticGroup, frequencyRank: card.frequencyRank, deckPosition: index + 1 }));
}

let greekPromise: Promise<DeckDefinition> | null = null;
let greekLesson3VocabularyPromise: Promise<DeckDefinition> | null = null;
let greekLesson3GrammarPromise: Promise<DeckDefinition> | null = null;
let latinPromise: Promise<DeckDefinition> | null = null;

export function loadGreekDeck() {
  greekPromise ??= fetchText("data/greek-cards.json").then((text) => { const source = JSON.parse(text) as GreekSourceCard[]; const cards: StudyCard[] = source.map((card, index) => { const letterCase = card.category.includes("uppercase") ? "uppercase" : card.category.includes("lowercase") ? "lowercase" : null; const studySource = card.category.startsWith("Alphabet") ? "alphabet" : card.category === "Accent marks" ? "grammar-mechanics" : "lesson-mechanics"; return { id: card.id, deckId: "greek-i", front: card.front, back: `${card.back_title}\n${card.back}`, reverseFront: letterCase ? `${card.back_title} — ${letterCase}` : card.back_title, reverseBack: `${card.front}\n${card.back}`, category: card.category, rank: index + 1, metadata: { backTitle: card.back_title, lesson: card.category === "Accent marks" ? 2 : 1, studySource } }; }); return { id: "greek-i", slug: "greek", title: "Greek I — Lessons 1–2", eyebrow: "Alphabet · punctuation · accents", description: "Fifty-five cards covering all uppercase and lowercase letters, punctuation, and accent marks.", language: "greek", cards, supportsReverse: true, sourceNote: "Greek I course deck; uppercase and lowercase remain separate cards." } satisfies DeckDefinition; }); return greekPromise;
}

export function loadGreekLesson3VocabularyDeck() {
  greekLesson3VocabularyPromise ??= fetchText("data/greek-lesson3-vocab.json").then((text) => {
    const source = JSON.parse(text) as GreekLesson3VocabularySourceCard[];
    const cards: StudyCard[] = source.map((card, index) => ({
      id: card.id,
      deckId: "alpha-omega-lesson3-vocab",
      front: card.greek,
      back: card.meaning,
      reverseFront: card.meaning,
      reverseBack: card.greek,
      category: "Lesson 3 Vocabulary",
      rank: index + 1,
      source: "From Alpha to Omega, Lesson 3",
      notes: card.part_of_speech,
      metadata: { lesson: card.lesson, studySource: "vocabulary", partOfSpeech: card.part_of_speech, pronunciation: classicalGreekPronunciation(card.greek) },
    }));
    return { id: "alpha-omega-lesson3-vocab", slug: "greek", title: "Greek Lesson 3 Vocabulary", eyebrow: "Lesson 3 vocabulary", description: "Eleven vocabulary entries supplied for Lesson 3, tracked separately from grammar forms.", language: "greek", cards, supportsReverse: true, sourceNote: "From Alpha to Omega, Lesson 3 vocabulary." } satisfies DeckDefinition;
  });
  return greekLesson3VocabularyPromise;
}

export function loadGreekLesson3GrammarDeck() {
  greekLesson3GrammarPromise ??= fetchText("data/greek-lesson3-grammar.json").then((text) => {
    const source = JSON.parse(text) as GreekLesson3GrammarSourceCard[];
    const cards: StudyCard[] = source.map((card, index) => ({
      id: card.id,
      deckId: "alpha-omega-lesson3-grammar",
      front: card.prompt,
      back: card.form,
      reverseFront: card.form,
      reverseBack: card.identification,
      category: card.category,
      rank: index + 1,
      source: "From Alpha to Omega, Lesson 3",
      notes: `${card.identification} · ending ${card.ending}`,
      metadata: { lesson: 3, studySource: "grammar-form", grammarGroup: card.category, ending: card.ending, identification: card.identification },
    }));
    return { id: "alpha-omega-lesson3-grammar", slug: "greek", title: "Greek Lesson 3 Grammar", eyebrow: "Present active forms", description: "Lesson 3 forms for the present active indicative, infinitive, and imperative, with independent forward and reverse progress.", language: "greek", cards, supportsReverse: true, sourceNote: "From Alpha to Omega, Lesson 3; model verb παιδεύω." } satisfies DeckDefinition;
  });
  return greekLesson3GrammarPromise;
}

export function loadLatinDeck() {
  latinPromise ??= fetchText("data/dickinson-latin-core.csv").then((text) => { const source = latinRowsToCards(parseCsv(text)); const cards: StudyCard[] = source.map((card) => { const definition = card.definition || (card.headword.trim() === "fore" ? "to be; to be going to be (future infinitive of sum)" : "No English gloss is supplied in the source."); return { id: card.id, deckId: "dickinson-latin-core", front: card.headword, back: definition, reverseFront: definition, reverseBack: card.headword, category: card.partOfSpeech || "Vocabulary", rank: card.frequencyRank, source: "Dickinson College Commentaries Latin Core Vocabulary", notes: [card.partOfSpeech, card.semanticGroup].filter(Boolean).join(" · "), metadata: { partOfSpeech: card.partOfSpeech, semanticGroup: card.semanticGroup, frequencyRank: card.frequencyRank, deckPosition: card.deckPosition } }; }); return { id: "dickinson-latin-core", slug: "latin", title: "Dickinson Latin Core Vocabulary", eyebrow: "Frequency-ranked adaptive review", description: "Begin with the 100 most frequent entries, then unlock 25 at a time while earlier vocabulary continues long-term review.", language: "latin", cards, supportsReverse: true, staged: { initialCount: 100, batchSize: 25 }, sourceNote: `All ${cards.length} supplied Dickinson entries are included.` } satisfies DeckDefinition; }); return latinPromise;
}
