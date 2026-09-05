import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HenleChartTable } from "../src/features/henle/henle-chart";
import type { HenleSourceCard } from "../src/features/henle/henle-data";

function card(overrides: Partial<HenleSourceCard>): HenleSourceCard {
  return {
    id: "test",
    deck_id: "henle-part1-forms",
    section: "Verbs",
    rule: 1,
    title: "Test chart",
    prompt: "Test prompt",
    front: "Test prompt",
    answer: "amā-",
    back: "amā-",
    source_pdf_page: 1,
    tags: [],
    note: "",
    study_subsection: "",
    reverse_front: "amā-",
    reverse_back: "Test prompt",
    ...overrides,
  };
}

describe("Henle whole charts", () => {
  it("makes explicit Henle stem and ending rows clear in the component guide", () => {
    const html = renderToStaticMarkup(<HenleChartTable
      revealed
      items={[
        card({ id: "stem", prompt: "Present stem", answer: "amā-", verb_form_group: "Stems" }),
        card({ id: "ending", prompt: "First person plural", answer: "-mus", verb_form_group: "Personal Endings" }),
      ]}
    />);

    expect(html).toContain("Stem / Ending");
    expect(html).toContain("How to read this answer");
    expect(html).toContain("Henle stem:");
    expect(html).toContain("amā-");
    expect(html).toContain("Henle ending:");
    expect(html).toContain("-mus");
  });

  it("recognizes stem and ending labels from broader source tags and prompt wording", () => {
    const html = renderToStaticMarkup(<HenleChartTable
      revealed
      items={[
        card({ id: "tagged-stem", prompt: "Future participle — stem", answer: "laudātūr-", tags: ["verb-stem"] }),
        card({ id: "tagged-ending", prompt: "Ending", answer: "-tis", tags: ["personal-endings"] }),
      ]}
    />);

    expect(html).toContain("Henle stem:");
    expect(html).toContain("Henle ending:");
  });

  it("splits ordinary finite forms into form base, personal ending, and complete form", () => {
    const html = renderToStaticMarkup(<HenleChartTable
      revealed
      items={[
        card({ id: "form-1", title: "First Conjugation — laudō — Active Indicative Present", prompt: "First Person Singular", answer: "laudō", verb_voice_group: "Active Voice", verb_form_group: "Indicative" }),
        card({ id: "form-2", title: "First Conjugation — laudō — Active Indicative Present", prompt: "Second Person Singular", answer: "laudās", verb_voice_group: "Active Voice", verb_form_group: "Indicative" }),
        card({ id: "form-3", title: "First Conjugation — laudō — Active Indicative Present", prompt: "First Person Plural", answer: "laudāmus", verb_voice_group: "Active Voice", verb_form_group: "Indicative" }),
      ]}
    />);

    expect(html).toContain("Stem / base");
    expect(html).toContain("laudā-");
    expect(html).toContain("Ending");
    expect(html).toContain("-mus");
    expect(html).toContain("Complete form");
    expect(html).toContain("laudāmus");
    expect(html).toContain("stem/form base + personal ending");
  });

  it("splits passive finite forms using passive personal endings", () => {
    const html = renderToStaticMarkup(<HenleChartTable
      revealed
      items={[
        card({ id: "passive-1", title: "First Conjugation — laudō — Passive Indicative Imperfect", prompt: "First Person Singular", answer: "laudābar", verb_voice_group: "Passive Voice", verb_form_group: "Indicative" }),
        card({ id: "passive-2", title: "First Conjugation — laudō — Passive Indicative Imperfect", prompt: "Second Person Singular", answer: "laudābāris", verb_voice_group: "Passive Voice", verb_form_group: "Indicative" }),
      ]}
    />);

    expect(html).toContain("laudāba-");
    expect(html).toContain("-r");
    expect(html).toContain("laudābā-");
    expect(html).toContain("-ris");
  });

  it("does not invent a component split when the source form is compound", () => {
    const html = renderToStaticMarkup(<HenleChartTable
      revealed
      items={[
        card({ id: "compound-1", title: "First Conjugation — laudō — Passive Indicative Perfect", prompt: "First Person Singular", answer: "laudātus, a, um sum", verb_voice_group: "Passive Voice", verb_form_group: "Indicative" }),
        card({ id: "compound-2", title: "First Conjugation — laudō — Passive Indicative Perfect", prompt: "Second Person Singular", answer: "laudātus, a, um es", verb_voice_group: "Passive Voice", verb_form_group: "Indicative" }),
      ]}
    />);

    expect(html).toContain("Complete form");
    expect(html).toContain("does not supply a defensible stem/personal-ending split");
  });
});