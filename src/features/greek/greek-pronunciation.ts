const baseMap: Record<string, string> = {
  α: "a", β: "b", γ: "g", δ: "d", ε: "e", ζ: "z", η: "ē", θ: "th",
  ι: "i", κ: "k", λ: "l", μ: "m", ν: "n", ξ: "x", ο: "o", π: "p",
  ρ: "r", σ: "s", ς: "s", τ: "t", υ: "y", φ: "ph", χ: "kh", ψ: "ps", ω: "ō",
  Α: "A", Β: "B", Γ: "G", Δ: "D", Ε: "E", Ζ: "Z", Η: "Ē", Θ: "Th",
  Ι: "I", Κ: "K", Λ: "L", Μ: "M", Ν: "N", Ξ: "X", Ο: "O", Π: "P",
  Ρ: "R", Σ: "S", Τ: "T", Υ: "Y", Φ: "Ph", Χ: "Kh", Ψ: "Ps", Ω: "Ō",
};

const longVowelMap: Record<string, string> = { a: "ā", A: "Ā", i: "ī", I: "Ī", y: "ȳ", Y: "Ȳ" };
const combining = /[\u0300-\u036f]/u;
const roughBreathing = "\u0314";
const acute = "\u0301";
const grave = "\u0300";
const circumflex = "\u0342";
const macron = "\u0304";
const diaeresis = "\u0308";
const iotaSubscript = "\u0345";

function accentLatin(value: string, mark: string) {
  const accent = mark === grave ? grave : mark === circumflex ? "\u0302" : acute;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    if (/[aeiouyāēīōȳAEIOUYĀĒĪŌȲ]/u.test(value[index])) {
      return `${value.slice(0, index + 1)}${accent}${value.slice(index + 1)}`.normalize("NFC");
    }
  }
  return value;
}

function transliterateCluster(base: string, marks: string[]) {
  let value = baseMap[base] ?? base;
  if (marks.includes(macron) && longVowelMap[value]) value = longVowelMap[value];
  if (marks.includes(diaeresis)) value = `${value}\u0308`.normalize("NFC");
  if (marks.includes(iotaSubscript)) value += "i";
  if (marks.includes(roughBreathing)) value = base === "ρ" || base === "Ρ" ? `${value}h` : `h${value}`;
  const accent = marks.find((mark) => mark === acute || mark === grave || mark === circumflex);
  if (accent) value = accentLatin(value, accent);
  return value;
}

function normalizeUpsilonDiphthongs(value: string) {
  const upsilon: Record<string, string> = { y: "u", ý: "ú", ỳ: "ù", ŷ: "û", Y: "U", Ý: "Ú", Ỳ: "Ù", Ŷ: "Û" };
  return value.replace(/([aeoēAEOĒ])([yýỳŷYÝỲŶ])/gu, (_match, first: string, second: string) => `${first}${upsilon[second] ?? second}`);
}

/**
 * Produces a compact Classical-Greek pronunciation guide using the same basic
 * reconstructed pronunciation conventions taught in From Alpha to Omega.
 * It intentionally stays close to scholarly romanization so it remains useful
 * for any future vocabulary lesson without maintaining a hand-written lookup.
 */
export function classicalGreekPronunciation(text: string) {
  const normalized = text.normalize("NFD");
  let output = "";
  for (let index = 0; index < normalized.length;) {
    const base = normalized[index];
    if (!baseMap[base]) { output += base; index += 1; continue; }
    const marks: string[] = [];
    let cursor = index + 1;
    while (cursor < normalized.length && combining.test(normalized[cursor])) { marks.push(normalized[cursor]); cursor += 1; }
    output += transliterateCluster(base, marks);
    index = cursor;
  }
  return normalizeUpsilonDiphthongs(output.normalize("NFC"));
}
