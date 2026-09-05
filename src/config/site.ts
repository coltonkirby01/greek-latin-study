export type CourseId = "greek" | "latin" | "reading";

export const primaryNavLinks = [
  { label: "Home", href: "/" },
  { label: "Greek", href: "/greek" },
  { label: "Latin", href: "/latin" },
  { label: "Reading", href: "/reading" },
] as const;

export const homeCourses = [
  {
    id: "greek",
    visual: "greek",
    count: "55 cards",
    eyebrow: "Greek",
    title: "Alphabet, punctuation, and accents",
    description: "Choose uppercase, lowercase, punctuation, and accent cards separately or combine several types in one adaptive study session.",
    href: "/greek",
    linkLabel: "Study Greek",
  },
  {
    id: "latin",
    visual: "latin",
    count: "Vocabulary + grammar",
    eyebrow: "Latin",
    title: "Dickinson vocabulary and Henle grammar",
    description: "Study vocabulary, individual grammar forms, whole charts, or mix them together. Narrow grammar by section, voice, mood/form, and verb family.",
    href: "/latin",
    linkLabel: "Study Latin",
  },
  {
    id: "reading",
    visual: "reading",
    count: "Greek & Latin",
    eyebrow: "Reading & Audio",
    title: "Follow a passage word by word",
    description: "Save readings, attach audio, navigate sentences, and use timing-based highlighting.",
    href: "/reading",
    linkLabel: "Open readings",
  },
] as const satisfies ReadonlyArray<{
  id: CourseId;
  visual: CourseId;
  count: string;
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  linkLabel: string;
}>;
