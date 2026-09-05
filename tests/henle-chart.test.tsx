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
  it("makes stems and endings explicit in revealed answers and the component guide", () => {
    const html = renderToStaticMarkup(<HenleChartTable
      revealed
      items={[
        card({ id: "stem", prompt: "Present stem", answer: "amā-", verb_form_group: "Stems" }),
        card({ id: "ending", prompt: "First person plural", answer: "-mus", verb_form_group: "Personal Endings" }),
      ]}
    />);

    expect(html).toContain("Stem / Ending");
    expect(html).toContain("How to read this answer");
    expect(html).toContain("Stem portion:");
    expect(html).toContain("amā-");
    expect(html).toContain("Ending portion:");
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

    expect(html).toContain("Stem portion:");
    expect(html).toContain("Ending portion:");
  });

  it("labels ordinary completed forms as complete forms rather than stems or endings", () => {
    const html = renderToStaticMarkup(<HenleChartTable
      revealed
      items={[
        card({ id: "form-1", prompt: "First Person Singular", answer: "laudō", verb_form_group: "Indicative" }),
        card({ id: "form-2", prompt: "Second Person Singular", answer: "laudās", verb_form_group: "Indicative" }),
      ]}
    />);

    expect(html).toContain("Complete form");
    expect(html).toContain("completed forms rather than a separate stem or ending table");
  });
});