import fs from "node:fs";
const path = "src/styles.css";
let text = fs.readFileSync(path, "utf8");
const old = `.compact-select-label {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-width: 0;
}
.compact-select-label::after {
  content: "";
  position: absolute;
  right: 0.95rem;
  width: 0.42rem;
  height: 0.42rem;
  border-right: 2px solid var(--ink-soft);
  border-bottom: 2px solid var(--ink-soft);
  transform: translateY(-18%) rotate(45deg);
  pointer-events: none;
}
.compact-select-label:has(select:disabled)::after { opacity: 0.45; }
.compact-select-label select {
  min-height: 40px;
  max-width: min(25rem, 46vw);
  padding: 0.45rem 2.75rem 0.45rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--foreground);
  background: var(--panel-2);
  appearance: none;
  -webkit-appearance: none;
  cursor: pointer;
}
.compact-select-label select:disabled { cursor: default; opacity: 0.65; }`;
const next = `.compact-select-label { position: relative; display: inline-flex; min-width: 0; }
.compact-select-label::after { content: "⌄"; position: absolute; right: 0.85rem; color: var(--ink-soft); pointer-events: none; }
.compact-select-label select { min-height: 40px; max-width: min(25rem, 46vw); padding: 0.45rem 2.35rem 0.45rem 0.8rem; border: 1px solid var(--border); border-radius: 999px; color: var(--foreground); background: var(--panel-2); appearance: none; }`;
if (!text.includes(old)) throw new Error("Current compact select CSS not found");
text = text.replace(old, next);
fs.writeFileSync(path, text);
