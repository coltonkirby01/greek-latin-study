export type CourseId = "greek" | "latin" | "henle" | "reading";

export const primaryNavLinks = [
  { label: "Home", href: "/" },
  { label: "Greek", href: "/greek" },
  { label: "Latin", href: "/latin" },
  { label: "Henle", href: "/henle" },
  { label: "Reading", href: "/reading" },
] as const;

export const homeCourses = [
  {
    id: "greek",
    visual: "greek",
    count: "55 cards",
    eyebrow: "Greek I",
    title: "Alphabet, punctuation, and accents",
    description: "Study symbols forward or recall each uppercase and lowercase form from its name.",
    href: "/greek",
    linkLabel: "Study Greek",
  },
  {
    id: "latin",
    visual: "latin",
    count: "997 entries",
    eyebrow: "Latin vocabulary",
    title: "Dickinson Core Vocabulary",
    description: "Begin with the top 100, then unlock 25 at a time in each study direction.",
    href: "/latin",
    linkLabel: "Study Latin",
  },
  {
    id: "henle",
    visual: "henle",
    count: "2,062 forms",
    eyebrow: "Henle Grammar",
    title: "Individual forms and whole charts",
    description: "Study all 331 supplied rule groups, including 248 complete-chart exercises.",
    href: "/henle",
    linkLabel: "Study grammar",
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
