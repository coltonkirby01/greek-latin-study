import { gzipSync } from "node:zlib";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const assetsDir = new URL("../dist/assets/", import.meta.url);
const entries = await readdir(assetsDir);

const mainJsCandidates = entries.filter((name) => /^index-.*\.js$/.test(name));
if (mainJsCandidates.length !== 1) {
  throw new Error(`Expected one main index JavaScript bundle, found ${mainJsCandidates.length}.`);
}

async function gzipKb(name) {
  const bytes = await readFile(new URL(name, assetsDir));
  return gzipSync(bytes).byteLength / 1024;
}

const mainJs = mainJsCandidates[0];
const mainJsGzipKb = await gzipKb(mainJs);
const cssFiles = entries.filter((name) => name.endsWith(".css"));
let cssGzipKb = 0;
for (const file of cssFiles) cssGzipKb += await gzipKb(file);

const budgets = {
  mainJsGzipKb: 160,
  cssGzipKb: 12,
};

console.log(`Bundle budget: main JS ${mainJsGzipKb.toFixed(1)} KB gzip / ${budgets.mainJsGzipKb} KB; CSS ${cssGzipKb.toFixed(1)} KB gzip / ${budgets.cssGzipKb} KB.`);

if (mainJsGzipKb > budgets.mainJsGzipKb) {
  throw new Error(`Main JavaScript bundle exceeds ${budgets.mainJsGzipKb} KB gzip.`);
}
if (cssGzipKb > budgets.cssGzipKb) {
  throw new Error(`CSS bundles exceed ${budgets.cssGzipKb} KB gzip.`);
}

// Touch metadata so missing/empty output is also caught clearly.
await stat(new URL("../dist/index.html", import.meta.url));
