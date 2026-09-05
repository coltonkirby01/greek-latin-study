import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { latinRowsToCards, parseCsv } from "../src/data/builtin-decks";
import { jsonToCards, rowsToCards } from "../src/features/decks/import-parser";
import { buildHenleCharts } from "../src/features/henle/henle-data";

describe("authoritative source migration", () => {
  it("preserves all existing source deck counts", () => {
    const greek = JSON.parse(fs.readFileSync("public/data/greek-cards.json", "utf8"));
    const greekLesson3Vocabulary = JSON.parse(fs.readFileSync("public/data/greek-lesson3-vocab.json", "utf8"));
    const greekLesson3Grammar = JSON.parse(fs.readFileSync("public/data/greek-lesson3-grammar.json", "utf8"));
    const latin = latinRowsToCards(parseCsv(fs.readFileSync("public/data/dickinson-latin-core.csv", "utf8")));
    const henle = JSON.parse(fs.readFileSync("public/data/henle-part1-forms.json", "utf8"));
    expect(greek).toHaveLength(55);
    expect(greekLesson3Vocabulary).toHaveLength(11);
    expect(greekLesson3Grammar).toHaveLength(11);
    expect(new Set(greekLesson3Grammar.map((card: { category: string }) => card.category))).toEqual(new Set(["Present Active Indicative", "Present Active Infinitive", "Present Active Imperative"]));
    expect(latin).toHaveLength(997);
    expect(henle.cards).toHaveLength(2_062);
    expect(new Set(henle.cards.map((card: { id: string }) => card.id)).size).toBe(2_062);
    expect(new Set(henle.cards.map((card: { rule: number }) => card.rule)).size).toBe(331);
    expect(henle.cards.every((card: { reverse_front?: string; reverse_back?: string }) => card.reverse_front && card.reverse_back)).toBe(true);
    expect(buildHenleCharts(henle.cards)).toHaveLength(248);
  });
});

describe("administrator importer", () => {
  it("parses CSV fields including Reverse Prompt", () => {
    const rows = parseCsv('Front,Back,Category,Rank,Reverse Prompt\n"amō","I love",Verb,1,"say I love"\n');
    expect(rowsToCards(rows)).toEqual([{ front: "amō", back: "I love", category: "Verb", rank: 1, source: "", notes: "", reversePrompt: "say I love" }]);
  });
  it("accepts JSON card arrays", () => {
    expect(jsonToCards([{ Front: "λόγος", Back: "word", Category: "Noun" }])[0]).toMatchObject({ front: "λόγος", back: "word", category: "Noun" });
  });
});
