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
    count: "",
    eyebrow: "Greek",
    title: "Lessons, vocabulary, and grammar",
    description: "Build one Greek study session from lesson-based material. Select entire headings at once or open them to combine narrower vocabulary, alphabet, punctuation, accent, and grammar categories.",
    href: "/greek",
    linkLabel: "Study Greek",
  },
  {
    id: "latin",
    visual: "latin",
    count: "",
    eyebrow: "Latin",
    title: "Dickinson vocabulary and Henle grammar",
    description: "Use one vertical selector for Latin vocabulary, Henle individual forms, and whole charts. Select a whole heading or open it to narrow by part of speech, section, voice, mood/form, or family.",
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
