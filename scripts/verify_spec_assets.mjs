import fs from "node:fs";
import path from "node:path";

const specPath = process.argv[2];
if (!specPath) {
  console.error("Usage: node scripts/verify_spec_assets.mjs <spec.json>");
  process.exit(2);
}
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
const root = path.dirname(path.resolve(specPath));
const assets = spec.assets ?? {};
const missing = [];
const invalid = [];
for (const [id, relative] of Object.entries(assets)) {
  if (typeof relative !== "string") {
    invalid.push(`${id}: asset path is not a string`);
    continue;
  }
  const file = path.resolve(root, relative);
  if (!fs.existsSync(file)) {
    missing.push(`${id}: ${path.relative(process.cwd(), file)}`);
    continue;
  }
  const data = fs.readFileSync(file);
  const isPng = data.length >= 24 &&
    data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (!isPng) invalid.push(`${id}: expected PNG at ${path.relative(process.cwd(), file)}`);
}
if (missing.length || invalid.length) {
  console.error("Diwali image asset preflight failed.");
  if (missing.length) console.error("Missing files:\n" + missing.map(x => " - " + x).join("\n"));
  if (invalid.length) console.error("Invalid files:\n" + invalid.map(x => " - " + x).join("\n"));
  console.error("Render stopped. Restore the original authored PNG assets; no substitute artwork will be generated.");
  process.exit(1);
}
console.log(`Verified ${Object.keys(assets).length} authored PNG assets.`);
