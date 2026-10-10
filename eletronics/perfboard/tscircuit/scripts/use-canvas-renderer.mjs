import { readFileSync, writeFileSync } from "node:fs";

// CLI 0.1.2283 embeds the PCB viewer in both bundles. Prefer Canvas at
// startup, including when the browser has previously saved WebGPU.
const original = 'uIn=()=>{const t=c1n(mh.RENDERING_ENGINE,"webgpu");return t==="canvas"||t==="webgpu"?t:"webgpu"}';
const patched = 'uIn=()=>{return "canvas"/* tedtronics: compatible PCB renderer */}';
const paths = ["cli/main.js", "lib/index.js"].map((name) =>
  new URL(`../node_modules/@tscircuit/cli/dist/${name}`, import.meta.url),
);

// Validate every bundle before writing; fail clearly if an upgrade changes it.
const updates = paths.map((path) => {
  const source = readFileSync(path, "utf8");
  if (source.includes(patched)) return { path, source };
  if (source.split(original).length !== 2) {
    throw new Error(`Cannot apply Canvas renderer fix to ${path.pathname}; review the installed CLI version.`);
  }
  return { path, source: source.replace(original, patched) };
});
for (const { path, source } of updates) writeFileSync(path, source);
console.log("PCB viewer starts with Canvas rendering.");
