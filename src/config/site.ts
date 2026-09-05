export type CourseId = "greek" | "latin" | "reading";

type CourseSourceLink = {
  label: string;
  href: string;
};

export const primaryNavLinks = [
  { label: "Home", href: "/" },
  { label: "Greek", href: "/greek" },
  { label: "Latin", href: "/latin" },
  { label: "Stats", href: "/stats" },
  { label: "Reading", href: "/reading" },
] as const;

export const homeCourses = [
  {
    id: "greek",
    visual: "greek",
    count: "",
    eyebrow: "Greek",
    title: "Anne H. Groton · From Alpha to Omega",
    description: "Greek flashcards are based on Anne H. Groton's From Alpha to Omega. The online source text supplied for this project is the fourth edition; the purchase link below is specifically for the current fifth edition (2025).",
    sourceLinks: [
      { label: "Online source text (4th ed.)", href: "https://archive.org/details/fromalphatoomega0000grot/page/28/mode/2up" },
      { label: "Buy the 5th edition on Amazon", href: "https://www.amazon.com/dp/1647930189" },
    ],
    href: "/greek",
    linkLabel: "Study Greek",
  },
  {
    id: "latin",
    visual: "latin",
    count: "",
    eyebrow: "Latin",
    title: "Dickinson Core Vocabulary · Henle Latin Grammar",
    description: "Latin vocabulary is sourced from Dickinson College Commentaries' Latin Core Vocabulary. Grammar forms and whole charts are based on the uploaded PDF of Robert J. Henle, S.J.'s Henle Latin Grammar.",
    sourceLinks: [
      { label: "Dickinson Latin Core Vocabulary", href: "https://dcc.dickinson.edu/latin-core-list1" },
      { label: "Buy Henle Latin Grammar on Amazon", href: "https://www.amazon.com/dp/0829401121" },
    ],
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
    sourceLinks: [] as CourseSourceLink[],
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
  sourceLinks: readonly CourseSourceLink[];
  href: string;
  linkLabel: string;
}>;
